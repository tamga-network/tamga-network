# Changelog — tamga-network

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The documents (docs, ARF) are 1.0.0 until the public
announcement; changes before it are folded into this release. The `@tamga-network/*` packages are versioned separately: they
are published on npm as test releases — `0.5.0` published, `0.5.2` prepared (the API may change in test releases); the
stable `1.0.0` comes when everything is ready.

## 0.5.2 — 2026-10-13 (packages, test release)

0.5.1 was not published; its content is in 0.5.2. The nine packages move from `0.5.0` to `0.5.2` together (`sdk_version` =
`@tamga-network/verifier@0.5.2`). Security and correctness fixes from two code reviews and small EU format fixes from the first
EU alignment review (2026-10-13); every fix has a test. Two signatures change (marked **breaking**) and some result types gain
values (listed below; callers that switch over them should handle the new values). There is no compatibility path
(development phase, fixed in place).

### Security

- `@tamga-network/wallet-core` — embedded disclosure policy (ADR-0046 K3): the registration certificate is bound to the
  request only by the organisation identifier, and registration certificates are public. A restricted policy is now evaluated
  only when the access certificate that signed the request is anchored: its fingerprint is the one pinned in the verifier's
  record in the signed list, or its chain verifies up to a CA of the signed list (`root_cas`). Otherwise the result is
  `not_evaluable` with the new reason `untrusted_access_certificate` — a self-signed certificate that copies a real
  verifier's organisation identifier is never "authorized". `checkDisclosurePolicy` and `disclosurePolicyContext` take a new
  optional last argument `registeredFingerprints`; new helper `accessCertAnchored`.
- `@tamga-network/wallet-core`, `@tamga-network/trust` — trust anchors for the access certificate chain: an x5c never carries
  the root (TS 119 472-2 RO-02), so a chain issued by a listed root CA never reached a listed fingerprint. An anchor may now be
  a certificate (`TrustAnchor` = SHA-256 fingerprint, PEM, base64 DER or DER bytes; from the signed list's
  `root_cas[].cert_pem`): the chain is anchored when its last verified certificate is signed by the anchor's key (issuer name
  equals the anchor's subject and the signature verifies). A fingerprint alone still anchors only a chain that contains the
  anchor. `trustAnchors` in `DisclosurePolicyContext`, `disclosurePolicyContext` and `checkDisclosurePolicy` accept
  `TrustAnchor[]`; new helper `splitTrustAnchors`; `anchoredChainCerts` gets the option `anchorCertificates` (the anchor is
  returned as the last trusted certificate, so a `roots_of_trust` entry naming the root CA matches).
- `@tamga-network/verifier` — identifier list addresses come from the credential: `PrefetchStatusCache.want` now learns an
  address only over `https`, only on a host the issuer declares in the signed list (`statusHostsOf`: the `status_list_base`
  and `issuer_url` hosts) and never on a private, loopback or link-local address (IP literals are refused, host names are
  resolved before every fetch). The cap is per issuer (`maxPerIssuer`, default 64) instead of global. `StatusCache.want`
  takes a third argument (`StatusListScope`); step D passes the issuer's record. Local development keeps working through
  `allowLocalIssuerUrls`. New exports: `statusHostsOf`, `isNonPublicAddress`, `PrefetchStatusCacheOptions`.
- `@tamga-network/verifier` — status list fetching (SSRF): `PrefetchStatusCache` no longer lets the HTTP client follow
  redirects. It follows at most `MAX_STATUS_REDIRECTS` (3) hops itself and re-checks every hop of a learned address (`https`,
  a host the issuer declares, public IP); the connection is pinned to the checked IP (`pinnedLookup`; SNI, certificate check
  and `Host` stay the host name), so a host name that resolves to a public address at check time and a private one at connect
  time (DNS rebinding) cannot reach an internal address. An address from the anchor log follows redirects only within its
  origin. Node only (the module already used `node:dns`; the browser `/web` subpath does not fetch status lists). New exports
  `nodeStatusTransport`, `pinnedLookup`, `MAX_STATUS_REDIRECTS`, types `StatusTransport`, `StatusHttpRequest`,
  `StatusHttpResponse`; new option `transport`. A custom `fetchText` passed to the constructor is only given the first
  address after its check and must not follow redirects.
- `@tamga-network/verifier`, `@tamga-network/trust` — identifier lists of external (federated, ADR-0036) issuers: the record
  of an issuer from an external list has no `issuer_url` / `status_list_base`, so its identifier list address was never
  learned and every external mdoc stayed `INDETERMINATE`. The allowed hosts now come, in order, from the external list's
  service supply points (`ServiceSupplyPoints` of the entity's issuance and revocation services, `https` only; TS 119 602
  JSON and TS 119 612 XML), or, when the list declares none, from the DNS names in the SAN of the document signer certificate
  (the mdoc x5chain leaf, whose chain was verified to the external anchor), with a public suffix check: a wildcard name
  `*.<base>` allows exactly one label below the base (not the base itself, not deeper names); any other name allows itself and
  its subdomains only when it is at least one label above the registrable domain (`pid.example.com.tr`), the registrable
  domain itself only exactly (`example.com.tr`); a public suffix (`com.tr`, `gov.tr`, `*.edu.tr`, `co.uk`, a bare ccTLD) is
  never taken. The check is a small embedded list (TR second-level domains of nic.tr and common second-level labels under any
  two-letter ccTLD), not the `psl` package: the packages avoid dependencies, and a conservative list only narrows the scope.
  No IPs, no single-label or local names. `https`, the public IP check, pinning and the per-issuer cap apply as for Tamga
  issuers. New: `ExternalIssuerAnswer.status_hosts`, `LoteService.supplyPoints`, `StatusListScope.domains`,
  `StatusListScope.wildcards`, `externalStatusScope`.

### EU format alignment

- `@tamga-network/verifier` — request object (ETSI TS 119 472-2 REDIRECTS_RO-02/03): `iat` is now also in the JWS protected
  header (and stays in the payload); `x5c` carries the leaf followed by the intermediate certificates when the access
  certificate is not issued directly by the root (never the root). `RpSigner` gets an optional `chainDer`; `pemRpSigner`
  accepts a chain file (first certificate = leaf) and an optional third argument `intermediatePems`; self-signed certificates
  are dropped.
- `@tamga-network/verifier` — **breaking:** registration certificate in `verifier_info` (TS 119 472-2 RO-13…16, ARF RPRC_19):
  exactly one per request, `{ format: "registration_cert", data: <WRPRC JWT> }`, no `credential_ids`.
  `createPresentationRequest({ registrationCerts: [...] })` becomes `registrationCert?: string`. RO-16's "base64url" is read
  as the JWT compact serialisation (already base64url parts), as the EU reference implementation and the German guide do.
  The reference verifier (`apps/verify`) picks the certificate of the intended use that covers the most queries
  (`registrationCertFor`). The wallet side (`@tamga-network/wallet-core`) still reads requests with `credential_ids`.
- `@tamga-network/trust` (re-exported by `@tamga-network/issuer`) — **breaking:** wallet attestation. Every OAuth client
  attestation (draft -07) is read as a wallet instance attestation; the old Tamga "WUA" path (declared `key_storage`,
  `solution_id`) is removed — the key storage level comes from the key attestation at the credential endpoint. A generic -07
  attestation without `client_status` no longer falls into that path: the new `clientStatus` policy decides
  (`"optional"`, the default, accepts it with result `clientStatus: "NOT_APPLICABLE"`; `"required"` rejects it). The result
  replaces `kind` with `clientStatus` (`VALID` / `NOT_CHECKED` / `NOT_APPLICABLE`). `iss` is accepted when present (must be a
  string) and not required; a missing `iat` in the attestation is tolerated, `iat` in the PoP stays required; the lifetime
  limit (under 24 hours, TS3) applies to every attestation. `minKeyStorage` and `minKeyStorageFor` are removed from
  `verifyWalletAttestation`.
- `@tamga-network/sd-jwt` — verification accepts the legacy `typ` `vc+sd-jwt` by default (allowed by SD-JWT VC -13;
  `acceptLegacyVcSdJwtTyp: false` turns it off); the result carries `typ`. Issuance stays `dc+sd-jwt`. The network verifier
  (`@tamga-network/verifier`) still rejects `vc+sd-jwt` for Tamga credential types (rule C13, step A2) and accepts it for
  external types. Callers that call `verifySdJwtVc` directly for Tamga types only should pass
  `acceptLegacyVcSdJwtTyp: false` (the conformance runner and the identity service do).
- `@tamga-network/wallet-core` — DCQL `trusted_authorities` (OpenID4VP §6.1.1): `aki` is evaluated as before; `etsi_tl`
  is evaluated against the trusted lists the wallet has loaded (new `matchDcql` option `trustedLists`, type
  `LoadedTrustedList`; the issuer's CA must be in a loaded TL / LoTE whose address equals the value); `openid_federation`,
  unknown types and an `etsi_tl` value whose list is not loaded are "not evaluable". An entry that is not evaluable does not
  filter the credential out — it is still offered and the verifier does its own trust check — but it is never a positive trust
  signal: the new `Match.trustedAuthority` is `"matched"` or `"not_evaluable"`, and only `"matched"` means the wallet
  checked it. A credential is left out only when every entry was evaluated and none matched. New export
  `evaluateTrustedAuthorities` (optional fourth argument: the query format). The issuer chain is read from the copy in the
  query's format — for `mso_mdoc` the IssuerAuth `x5chain` (COSE header 33; for `mso_mdoc_zk` the ZK copy's), for `dc+sd-jwt`
  the x5c, falling back to the other representation — so a credential with only an mdoc copy can match `aki` and `etsi_tl`.
  `@tamga-network/trust`: `ListTrustSource.externalTrustedLists()` gives the loaded external lists in that shape.

### Hardening

- `@tamga-network/issuer` — `WalletStatusChecker`: a wallet instance or key attestation status list with fewer than 10,000
  entries (CIR 2026/1731 Annex Ib; `WALLET_STATUS_MIN_ENTRIES`) is refused. On by default; the new fourth constructor
  argument `{ minEntries }` sets the threshold (`0` turns it off, development only). `StatusValueOf` gains the value
  `NONCOMPLIANT` (signed and readable but outside the profile): `verifyWalletAttestation` and `verifyKeyAttestation` reject
  it (not indeterminate). The bit is read first: a set bit is `INVALID` (revoked) whatever the list size, so a
  revoked unit on an undersized list is still seen as revoked (cascading revocation keeps working); `NONCOMPLIANT` only when the
  bit is not set.

### Fixes

- `@tamga-network/wallet-core` — wallet to wallet: the revocation check now has the network verifier's three outcomes. A
  status list or identifier list signed by a key other than the issuer's registered status key, with a bad signature, a
  wrong address or an index outside the list is `invalid` (new reason `status_invalid`); a list that cannot be fetched, has
  expired, cannot be read, or an issuer without a registered status key is `indeterminate` (new reason
  `status_unavailable`). It was `valid` with `revocation: "unchecked"`. A valid result now carries `revocation: "checked"` or
  `"not_applicable"` (the credential has no revocation entry).
- `@tamga-network/mdoc` — `verifyIssuerSigned`: the clock skew tolerance (`clockSkewSec`) applies only to `validFrom`;
  `validUntil` is no longer extended (same rule as SD-JWT `exp`).
- `@tamga-network/mdoc` — a `status` entry in the MSO that cannot be read (not a map, no known mechanism, bad `idx` / `uri`
  / `id`) no longer skips the revocation check silently: the credential is invalid (`status entry malformed`). The verifier
  reports it at step `D1` (`REJECTED`); the wallet refuses to store such a credential.
- `@tamga-network/wallet-core` — revocation maintenance period preference: the remaining period is compared with a tolerance
  (`statusPeriodMet`, `STATUS_PERIOD_TOLERANCE_SEC`: up to 7 days and at most 10 % of the preference). An issuer that asks
  for the wallet provider's maximum period no longer makes the wallet fetch a new wallet instance attestation on every flow.

## 0.5.0 — 2026-10-12 (packages, test release)

The nine packages move to `0.5.0` together (`sdk_version` = `@tamga-network/verifier@0.5.0`). Minor: new fields, functions and
subpath-free modules; nothing removed. One signature widens (the key attestation producer gets an optional second argument), so
existing callers keep working.

### Issuer preferences for wallet attestations (EU ARF WUA_05a, WUA_32, ISSU_12c; EU TS3 v1.5 §2.4)

- `@tamga-network/wallet-core`: `issuerAttestationPrefs(metadata, configurationId)` reads `key_attestations_required`
  (`key_storage`, `user_authentication`, `preferred_key_storage_status_period`) and the top-level
  `preferred_client_status_period`. Issuance passes the requirement to the key attestation producer
  (`KeyAttestor = (jwks, req?) => Promise<string>`, `req.minStatusPeriod`) and does not send a key attestation whose
  `key_storage` / `user_authentication` misses the issuer's accepted levels (clear `unsupported` error; generated keys are
  deleted). `redeem({ renewWua })` and `startAuthorized({ renewWua })` ask the wallet provider for a WIA with a longer
  revocation maintenance period when the current one is shorter than the issuer's preference; the WIA used at PAR is reused at
  the token endpoint (`AuthStart.wua`). A preference the provider cannot meet does not block issuance. Helpers:
  `checkKeyAttestation`, `keyAttestationRequestOf`, `wiaStatusRemaining`, `wiaMeetsPreference`, `wuaForIssuer`.
- `@tamga-network/issuer`: `issuerMetadata({ preferredClientStatusPeriod, keyAttestationsRequired: {
  preferred_key_storage_status_period } })`; `verifyKeyAttestation` returns `statusExp`; `capToRevocationMaintenance(exp, {
  wiaStatusExp, kaStatusExp })` for issuers that revoke in a chain (ISSU_12c; ADR-0047 K1).

### EU trusted lists in the older XML format (ETSI TS 119 612; ARF OIA_15b, ISSU_10b, ISSU_28a; ADR-0036)

- `@tamga-network/trust` (`/core` too): `readTrustedListXml(xml, pinnedFingerprints)` verifies the enveloped XML signature and
  maps the list into the same model as the LoTE reader, so the federation rules apply unchanged (scope FD2, pinned signer FD1,
  freshness, rollback). Service types `…/Svctype/EAA/Q`, `…/Svctype/EAA`, `…/Svctype/EAA/Pub-EAA` become `eaa_provider`; other
  types are ignored; only `granted` / `recognisedatnationallevel` services are taken. `TSLVersionIdentifier` 5 or 6.
- `verifyEnvelopedXmlSignature`: platform-independent XMLDSig (works in the wallet). One `ds:Signature` under the root, a
  whole-document reference with the enveloped-signature transform (required), optional XAdES `SignedProperties` reference;
  C14N 1.0 and Exclusive C14N 1.0; rsa-sha256/384/512 and ecdsa-sha256/384/512 (P-256/384/521); DTDs, SHA-1 and XPath
  transforms are refused. New dependency: `@xmldom/xmldom` (DOM parser, no dependencies); canonicalisation and signature
  checks are in the package (`@noble/curves`, `@noble/hashes`). Checked against the EU list of lists and eight published
  national trusted lists (RSA and ECDSA); tests sign with an independent implementation (`xml-crypto`, dev only).
- External list pointers with `format: "etsi-tl-xml"` are now loaded (`applyExternalListsWith`, `fetchListTrustSource({
  externalLists })`; the publisher's copy is `external/<list_id>.xml`). The list publisher's `external-fetch` copies TL XML
  lists too.
- `@tamga-network/wallet-core`: `fetchTrustSource({ externalLists })` loads the external lists in the wallet.

### Attestation Revocation List (CIR 2024/2979 Annex II as amended; ARF VCR_10, VCR_12)

- `@tamga-network/mdoc`: `signIdentifierListToken`, `verifyIdentifierListToken`, `identifierRevoked` —
  `application/identifierlist+cwt` (COSE_Sign1 ES256, `typ` and `x5chain` in the protected header, `IdentifierList` at claim
  65530, `exp` required). `issueMdoc({ identifierList })` writes `status.identifier_list`; `verifyIssuerSigned` returns
  `identifierList`.
- `@tamga-network/verifier`: an mdoc that carries `identifier_list` (and no `status_list`) is checked in step D with the same
  rules as the status list (prefetch cache, the issuer's registered status key S11, freshness; revoked → `REJECTED` at D6;
  missing or stale → `INDETERMINATE`). The prefetch cache stores CWT bodies as base64url.
- Tamga issuers keep using the status list (VCR_11 allows either); the identifier list is supported for verification so
  that relying parties and wallets accept both mechanisms.

### Wallet-to-wallet protocol in `wallet-core` (ARF Topic 30)

- `@tamga-network/wallet-core`: `runW2wVerifier`, `verifyW2wResponse` (status list and identifier list), `presentToPerson`,
  `mergeHolderResult`, `buildW2wRequest`, `isEngagementQr`, `fakeBleLink`, `CentralTransport`, with a wallet-chosen
  `W2wProfile` (type, namespace, allowed fields). A credential whose issuer restricts disclosure (ADR-0046) is never shown
  wallet to wallet (`reason: "restricted"`).
- `presentProximity`: the request view carries `disclosurePolicy` (offline evaluation; a restricted credential is
  `not_evaluable`), so the consent screen can warn in proximity presentation.

### Embedded disclosure policy (ADR-0046, EU ARF Topic 43)

- `@tamga-network/core/disclosure-policy` (new subpath; dependency-free, React Native safe): the policy data model
  (`EmbeddedDisclosurePolicy`; types `none`, `authorized_relying_parties`, `specific_roots_of_trust`), `validateDisclosurePolicy`
  (unknown members are dropped), `disclosurePolicyDigest` (`sha256:<hex>` over the known members, order-independent),
  `restrictsDisclosure`, and RFC 4514 name handling (`parseDn`, `dnEquals` with `ORGID`/`SN` per ETSI TS 119 472-3,
  `serialEquals`).
- `@tamga-network/schemas`: `EMBEDDED_DISCLOSURE_POLICY_SCHEMA` (JSON Schema 2020-12) and `acceptsDisclosurePolicy(vct)` —
  institution credentials only; the `urn:tamga:id:*`, `urn:tamga:contact:*` and core types refuse a policy.
- `@tamga-network/issuer`: `issuerMetadata({ authorizedVcts: [{ …, disclosurePolicy }] })` publishes the policy by value in
  `credential_metadata.embedded_disclosure_policy`; a malformed policy or one on a non-institution type throws
  (`checkedDisclosurePolicy`). The digest and validator are re-exported for the credential record (EP4).
- `@tamga-network/trust` (`/core` too): `certNames(der)` (subject, issuer, serial), `certSubjectMatches`,
  `certMatchesRootOfTrust`. The trust list relying party scope gets an optional `service_id`.
- `@tamga-network/wallet-core`: `receiveCredentials` stores the policy from the issuer metadata on the credential record
  (`StoredCredential.disclosurePolicy`: policy + digest, or `malformed`); `checkDisclosurePolicy(request, registrarKeys, match)`
  evaluates it offline against the verified registration certificates and the access certificate chain — (a) registration
  certificate `sub` + `service_id`, (b) access certificate subject name (not for intermediated requests), (c) entitlement,
  or a listed root of trust in either chain — and returns `passed` / `failed` / `not_evaluable` with the reason and the
  `info_uri`. Without a registration certificate (proximity, wallet-to-wallet: `offlineDisclosurePolicy`) a restricting policy
  is not evaluable. Lower level: `disclosurePolicyFromMetadata`, `evaluateDisclosurePolicy`, `disclosurePolicyContext`,
  `relevantRegistrationCerts`; `verifyWrprc` also returns the signing chain, `VpRequest.chainDer` carries the request's x5c.
- `@tamga-network/verifier`: no change (the policy is never sent to the verifier).

### Registration certificate service identifier (ARF RPRC_17a)

- The list publisher writes `service_id` into every relying party registration certificate (the scope's `service_id`, or its
  `scope_id`). The sandbox verifier gets a second diploma use (`alumni-network`) and the `alumni-network` scenario policy, so
  an allowed and a not-allowed service of the same verifier can be tried against the sandbox's example policy.

### Institution revocation conditions link (ADR-0047 K2)

- `@tamga-network/trust`: the issuer entry gets an optional `revocation_policy_uri` (the page of conditions an institution adds
  to the network's common revocation policy). The list publisher's registration tool accepts it (https only).
- `@tamga-network/wallet-core`: the institution directory entry carries `infoUri` and `revocationPolicyUri` (https only);
  `toDirectoryEntry` is exported.

### Fixes from the pre-release review

- **Root-of-trust policy could be bypassed** (`specific_roots_of_trust`, ADR-0046 K3). The wallet compared the policy's roots
  against the raw `x5c` arrays, so a verifier could append the policy's root, or make its own certificate with the root's name
  and serial number, and pass. Now only certificates whose signature chain is verified from the leaf up to that certificate
  *and* anchored in trust count: the registration certificate chain starts at the registrar key from the signed list (its
  self-signed direct issuer also counts); the access certificate chain counts only when it reaches a trusted CA fingerprint
  (`checkDisclosurePolicy(…, now, trustAnchors)`, `DisclosurePolicyContext.trustAnchors`). A root that matches only an
  unverified certificate gives `not_evaluable` (new reason `unverified_chain`: the warning is shown and the default is "do not
  share"), never `passed`. `certMatchesRootOfTrust` no longer accepts a match on the subject name (IssuerSerial only).
  `@tamga-network/trust` (`/core` too) gains `verifyCertSignature` (ES256/384/512, RS256/384/512, PS256/384/512),
  `isSelfSigned`, `verifiedChainPrefix` and `anchoredChainCerts`.
- **Trusted list pin checked first.** `readTrustedListXml` compares the signer certificate's fingerprint with the pinned
  fingerprints before any digest, canonicalisation or signature work (`verifyEnvelopedXmlSignature(xml, { checkSigner })`).
  RSA keys are bounded: modulus 2048–4096 bits, odd public exponent 3 … 2^32+1.
- **Identifier lists kept as bytes and fetched.** The verifier's prefetch cache decides by the list type, not the
  content-type, whether a body is binary: an identifier list (CWT) is always stored as bytes (`b64u:`); with an unknown type,
  `application/cwt`, `application/cbor`, `application/octet-stream`, `+cwt` / `+cbor` or a body that is not UTF-8 is kept as
  bytes (`statusBodyForCache`, `isBinaryStatusContentType`). An unreadable identifier list (bad base64url, not CBOR, not a
  COSE_Sign1) is `INDETERMINATE` at D4, not `REJECTED` at D3 (`verifyIdentifierListToken` reports it with the `D4:` prefix).
  `b64uToBytes` (`@tamga-network/core`) is strict: characters outside the base64url alphabet or an invalid length throw.
  Identifier lists have no anchor log entry, so the reference verifier never fetched them: an identifier list address seen in a
  verified credential is now added to the prefetch set (`StatusCache.want`, `PrefetchStatusCache.learnedRefs`) and fetched
  outside the verification; that first verification is `INDETERMINATE` (D2), later ones read the cache, and every prefetch round
  refreshes the list (no fetch per verification, S12).

## [1.0.0] — 2026-10-04

First release of the Tamga Network documentation set and reference implementation.

### 2026-10-13 — trust-publisher: wallet provider command

- `npm run trust:wallet-provider -- list|show|activate|suspend|revoke` (`apps/trust-publisher`): manages
  `wallet_providers[]` in the production and sandbox registries without hand-editing JSON. `activate --id <id> --cert <pem>`
  checks the certificate against the wallet attestation policy (single PEM certificate, no private key; EC P-256 with
  ecdsa-with-SHA256; `digitalSignature`, no `keyCertSign`/`cRLSign`; not a CA; within its validity; no `(TEST)` certificate in
  the production list), prints the SHA-256 fingerprint, writes `wallet-provider-<id>.cert.pem` to each PKI folder and sets the
  entry `ACTIVE` with the certificate and a `status_history` entry. Production comes first; a real certificate enters the
  sandbox list only after the production entry carries it. `--dry-run` prints the diff; a second run changes nothing; all
  targets are checked before anything is written. The command does not sign lists (production is signed on the network server
  at deploy). The build changelog line now also lists wallet providers and their status. Nothing is activated:
  `TAMGA-WP-1` stays `RESERVED`.

### 2026-10-13 — wallet provider certificate file name

- `apps/trust-publisher/README.md`: naming rule for wallet provider certificates in `wua_signing_certs[]` —
  `wallet-provider-<provider_id in lower case>`; for `TAMGA-WP-1` the name is `wallet-provider-tamga-wp-1` (published as
  `keys/wallet-provider-tamga-wp-1.cert.pem` in both lists; approved by project management). Plain `wallet-provider` stays
  reserved for the sandbox test provider. Nothing is activated: `TAMGA-WP-1` stays `RESERVED` with no certificate.

### 2026-10-12 — decisions on the rulebook template work (ADR-0047)

- ADR-0047 accepted: wallet unit revocation does not revoke institution credentials (they are bound to a device key and cannot
  be used once the unit is revoked; the identity service still revokes its own, RB-AP-ID-12); institutions may publish
  additional revocation conditions with `revocation_policy_uri` (RB-AP-27); every wallet provider offers a revocation path
  without the phone and without a user account (RB-WP-15) and at least one way outside the wallet to learn that the unit was
  revoked (RB-WP-16); device attestation is mandatory at W3 only (RB-WP-17). No non-qualified EAA indicator is written (ETSI TS
  119 472-1 EAA-5.2.2.1-01) and no trust anchor location field is added to credentials (ARB_12, ARB_21). The diploma I3
  question is a deferred decision with a trigger.
- Wallet Attestation Policy: line-by-line mapping to ETSI TS 119 471 clauses 6–7 (WURevocation_03), with the provider
  obligations that had no counterpart. ADR-0025 K4 (lost or stolen device) points to ADR-0047. Documents stay at 1.0.0.

### 2026-10-12 — Tamga ARF: rulebooks in the EU template structure; revocation and wallet attestation policies

- The credential type rulebooks (Education, Identity, Event Ticket) follow the section structure of the EU Attestation Rulebook
  template (1.5): attributes and metadata (mandatory, optional, conditional), legal category (`category`), encoding per format
  (mdoc, SD-JWT VC with selective disclosure per claim), usage, trust anchors, validity and revocation, compliance. The rules did
  not change. Tamga Rulebook §11 maps ARF Annex 2 Topic 12 to the rulebook sections.
- New Contact Rulebook (verified email address and phone number, from ADR-0021), Revocation Policy (ARF VCR_05) and Wallet
  Attestation Policy (WIA and KA; ARF WURevocation_03, 09a). They compile existing decisions; open points are listed in each
  document. Documents stay at 1.0.0; no code change.

### 2026-10-11 — documents: embedded disclosure policy, `issuing_country`

- ADR-0046 accepted: an issuer may publish an embedded disclosure policy for an institution credential type by value in its
  signed Credential Issuer metadata (`credential_metadata.embedded_disclosure_policy`); the wallet stores it at issuance,
  evaluates it at presentation and warns (default "don't share"); a policy change revokes the credentials of that
  configuration. OpenID4VCI profile §2.1, wallet rules §5.5, Tamga Rulebook RB-AP-26 and RB-WP-14, Tamga ARF. Code comes with
  the `0.5.0` packages.
- `issuing_country` in the identity credential: the field has its EU PID meaning; today the value reflects the country of the
  scanned identity document (Identity Rulebook §9, identity proofing §9). No code change.

### 2026-10-09 — packages: 0.4.0 test release

The nine packages move to `0.4.0` together (`sdk_version` = `@tamga-network/verifier@0.4.0`). Interface changes, so callers
must update:

- Identity credential attribute names follow the EU PID encoding (ADR-0045): SD-JWT VC `birthdate` and `nationalities[]`;
  mdoc `birth_date` (full-date) and `nationality` (array). Credentials and requests with the old names no longer match.
- ZK presentation only with the short-lived ZK copy (ADR-0044): new type `urn:tamga:id:ShortLivedIdentityAttestation:1`; the
  verifier accepts it without `accept_unrevocable_zk`; `wallet-core` refreshes ZK copies (`refreshZkCopies`) and matches
  `mso_mdoc_zk` only with them. `Match.zk.copyKeyRef`, `matchDcql(…, { now })`, `StoredCredential.zk` are new;
  `matchClaimValue(match, name)` gives the value to show for a requested field in either format.
- `@tamga-network/mdoc` `verifyIssuerSigned({ clockSkewSec })`: the validity window widens by the tolerance on both ends.
  `wallet-core` accepts a freshly issued mdoc and ZK copy with a 5-minute tolerance (a phone clock a few seconds behind the
  issuer no longer rejects the credential as "not yet valid"); the verifier uses the policy's `max_clock_skew_sec` (default
  120 s) for mdoc validity.
- New: `@tamga-network/core/pid` subpath; `@tamga-network/mdoc` depends on `@tamga-network/core`; `sd-jwt`
  `arrayElementSd`; `issuer` `issuerMetadata({ mdocConfigurations })`.
- Details in the two entries below.

### 2026-10-09 — ZK presentation only with short-lived copies (ADR-0044 implemented)

- New catalogue type `urn:tamga:id:ShortLivedIdentityAttestation:1` (ISO mdoc only, namespace `tamga.id.1`, only
  `age_over_18`): the ZK copy of the identity credential. Type rule: valid for at most 24 hours, no revocation list entry
  (EU ARF VCR_01). The Longfellow proof binds the docType, so the type is the short-validity marker (ADR-0044 K1).
  `@tamga-network/schemas`: `ZK_COPY_VCT`, `isShortLivedType`.
- `@tamga-network/verifier`: a ZK presentation whose proven type is short-lived is accepted without
  `accept_unrevocable_zk` (`status.value = NOT_APPLICABLE`, reason: short validity); an unmarked ZK presentation still needs
  the flag (ZC4). Tamga Verify's `age-over-18-zk` policy asks for the ZK copy type; `accept_unrevocable_zk: true` was removed.
  The trust lists authorise the identity service for the new type and give Tamga Verify an `age-over-18-zk-1` scope.
- `@tamga-network/wallet-core`: the identity service's `refresh_token` (identity credential only) becomes a ZK copy binding
  (`StoredCredential.zk`); `refreshZkCopies` (refresh token grant with DPoP + WIA → a batch of 3 copies, each checked: same
  issuer certificate, type, device key, no status, ≤ 24 hours), `scheduleZkRefreshes` (window 8 hours before expiry, random
  delay up to 6 hours), `selectZkCopy`; DCQL `mso_mdoc_zk` matches only a valid ZK copy and the proof is made with it — the
  main credential's mdoc is never used for ZK (ZC1). `removeCredential` also returns the ZK keys.
- `@tamga-network/issuer`: `issuerMetadata({ mdocConfigurations })` announces `mso_mdoc` configurations (`doctype`,
  `cose_key`, COSE `-7`).
- Specifications: SPEC-PROTO-0001 §4.2 (ZK copy token), SPEC-WALLET-0001 §4.5, SPEC-API-0001 D1, Identity Rulebook §6.1, Tamga
  Rulebook RB-AP-ID-11, ARF L5, guides and concept pages. Real Longfellow fixtures for the ZK copy (`zk-copy.cbor`).

### 2026-10-09 — identity credential: EU PID attribute names (ADR-0045)

- ADR-0045 (accepted): the identity credential (`urn:tamga:id:IdentityAttestation:1`) uses the EU PID names and encodings of
  Implementing Regulation (EU) 2026/1731. SD-JWT VC: `birthdate` (was `birth_date`) and `nationalities`, an array whose elements
  are disclosed one by one (was the single-valued `nationality`). mdoc (namespace `tamga.id.1`): `birth_date` encoded as
  `full-date` (#6.1004) and an array-valued `nationality`. `age_over_18` stays (it is not in the EU PID set). Type, docType and
  namespace are unchanged. Development stage (ADR-0029): fixed in place, no compatibility shim — wallets obtain the identity
  credential again.
- `@tamga-network/core/pid`: the EU PID name table (mdoc identifier ↔ SD-JWT VC claim name). `@tamga-network/mdoc`:
  `toPidMdocElements` and `plainElementValue`. `@tamga-network/sd-jwt`: `arrayElementSd` issues array elements as separate
  disclosures (RFC 9901 §4.2.2); `@tamga-network/issuer` reads it from the Type Metadata (`path: [name, null]`) and
  `identityMatchKeys` reads `birthdate`. `@tamga-network/verifier`: mdoc element names are mapped to the catalogue names for the
  schema check (B6) and the scope checks (AP6, E3); `full-date`/`tdate` values come out as strings. `@tamga-network/wallet-core`:
  mdoc and proximity requests match the credential's SD-JWT claims through the same table (MD1); the driving licence
  prerequisite discloses `birthdate`.
- Trust lists: the institutions' identity matching scope asks for `birthdate`. Identity Rulebook §1, §6, §9 and SPEC-ID-0003 §9
  updated; the EU PID mdoc schema used for external credentials now names `family_name_birth` / `given_name_birth` as in
  Table 6. Conformance vectors version 4 (new `sd-jwt/identity-pid-names`).
- Tamga Rulebook RB-GEN-05: debug logs are kept for at most 1 day (was 7 days).

### 2026-10-09 — packages: 0.3.1 test release (patch)

- `@tamga-network/sd-jwt` `verifyStatusListToken`: the `iat + 2 × ttl` staleness rule is removed. The limit is the token's
  `exp` plus the policy's `max_status_token_age_sec` (SPEC-CRED-0003 §8.1; draft-20 `ttl` is a refresh hint). The 6-hour
  outage buffer of the network's status lists now reaches verifiers on 0.3.1. An optional `maxAgeSec` sets an age limit for
  callers without a policy. A newer anchor that cannot be fetched still gives INDETERMINATE (D5).
- `signStatusListToken` takes an optional `expSec` (`exp − iat`, at least `2 × ttl`; default `2 × ttl` as before).
- `@tamga-network/verifier`: a missing `accept_unrevocable_zk` now means `false` (ADR-0044 ZC4) — a ZK presentation is
  INDETERMINATE (D1) unless the policy explicitly sets `true`. Policies that accept ZK presentations must now say so.
  Tamga Verify's `age-over-18-zk` sets it explicitly and `/policies` shows the flag for ZK policies.
- `@tamga-network/wallet-core`: on `invalid_nonce` from the credential endpoint (OpenID4VCI 1.0 §8.3.1.2) the wallet fetches
  a fresh `c_nonce` from the nonce endpoint, re-signs the proofs and retries once. The keys and the key attestation are reused.
- The other packages (`core`, `mdoc`, `schemas`, `trust`, `issuer`, `zk`) only move to 0.3.1 with the set; their code is
  unchanged. `sdk_version` is `@tamga-network/verifier@0.3.1`.

### 2026-10-09 — revocation lists: decisions on noise, `exp`, hosted service; ZK short-lived copies

- Status list (SPEC-CRED-0003): the 1% initial-noise rule is removed (it had no observable effect). The publication interval
  stays short (2 minutes; `ttl` = the interval) and `exp` becomes `iat + 6 hours` — `ttl` is the draft-20 refresh hint, `exp`
  the absolute limit, matching the 6-hour maximum token age of verifier policies. The network's services sign with the new
  `exp`; `@tamga-network/sd-jwt` 0.3.0 still treats a token as stale after `2 × ttl`, so the outage buffer reaches verifiers
  with the next patch release. Hosted status service (§10.2): key separation and key location described as they are; the
  revocation list endpoints keep no access log. The ARF, trust framework and rulebooks say "a revocation takes effect within
  a few minutes" instead of the 60/90-minute pilot values.
- ADR-0044 (accepted): a ZK presentation uses only short-lived ZK copies (≤ 24 hours, no revocation list entry), refreshed
  silently and not re-issued once the main credential is revoked or suspended — the EU ARF's short-lived attestation path.
  ADR-0023 AR4 gets a narrow exception for the ZK copy token. Implementation pending (next minor package release).

### 2026-10-09 — standards alignment (OpenID4VCI 1.0 Final, OpenID4VP 1.0, HAIP 1.0); packages: 0.3.0 test release

Wire format changes (breaking for test-release users; update issuer, wallet and wallet provider together):

- Key attestation JWT `typ` is `key-attestation+jwt` (OpenID4VCI 1.0 Final Annex D.1); the draft value
  `keyattestation+jwt` is rejected.
- The token response no longer carries `c_nonce` / `c_nonce_expires_in`; the nonce endpoint returns only `c_nonce` with
  `Cache-Control: no-store`. `wallet-core` takes the nonce only from the issuer's `nonce_endpoint` (required).
- The credential response no longer carries `notification_id` (no notification endpoint is offered).
- Credential endpoint errors follow OpenID4VCI 1.0 §8.3.1.2: `unknown_credential_configuration` for a configuration the
  issuer does not offer, `invalid_nonce` for an unknown, expired or consumed `c_nonce` (`ProofCheck.invalidNonce`),
  `credential_request_denied` when the type is no longer authorised in the trust list.
- `sd-jwt`: disclosures are serialised with the issuer convention of SPEC-CRED-0002 §3.5 (`", "` / `": "` separators,
  non-ASCII escaped as `\uXXXX`); verification is unchanged (the string is hashed as it is). The specification's example
  values are now a test.
- ZK presentations: the `status.reason` text no longer claims the credential is short-lived.

Documentation:

- OpenID4VCI profile: examples use an example institution and `vct` URNs as configuration identifiers and scopes; nonce
  lifetime 5 minutes without `c_nonce_expires_in`; deferred issuance (HTTP 202 + `transaction_id` + `interval`, DPoP) and the
  notification endpoint are documented as not offered today, with the Final semantics of `credential_deleted`; PAR uses
  `scope`; error table aligned with Final.
- OpenID4VP profile: response encryption `A128GCM` or `A256GCM` (HAIP §5); browser Digital Credentials API and ISO 18013-5
  proximity status updated. ADR-0013: SessionTranscript follows the OpenID4VP 1.0 Final handovers.
- Status list: Token Status List draft-20 (the EU reference in CIR 2026/1731), draft-21 noted; today's publication interval,
  `exp`, initial noise and hosted-service key/log described as they are, with open topics for decision.
- SD-JWT VC / schema catalogue: `schema_uri#integrity` documented as a Tamga extension. Concept page: `tx_code` is mandatory in
  the pre-authorized flow. ADR-0032: implementation note on ZK and revocation.
- Conformance vectors (version 3) use an example institution; the development PKI's example university leaf is named
  "Ornek Universitesi (DEV)".
- The `@tamga-network/*` packages are versioned `0.3.0` (test release); `sdk_version` is `@tamga-network/verifier@0.3.0`.

### 2026-10-09 — sandbox registration certificates

- Sandbox: the access certificates of `verify.sandbox.tamga.network` and `issuer.sandbox.tamga.network` now carry the
  organisation identifier (`organizationIdentifier`, EN 319 412-1) that their registration certificates name as `sub`
  (ADR-0026 K3). Without it a wallet cannot bind the registration certificate to the request and refuses it; every sandbox
  verification scenario that sends a registration certificate was affected. Same keys, new certificates (new `x509_hash`
  client identifiers); pseudonyms are unaffected (they follow the stable domain name, ADR-0034).
- List publisher: a registration certificate is no longer issued when the signing access certificate's organisation
  identifier does not match its `sub` (or `intermediary.sub`); the publisher warns instead.
- `ops/gen-pki.ts --reissue=<name,…>` re-signs selected leaf certificates with their existing keys (not in production mode).

### 2026-10-09 — API reference and repository layout

- docs.tamga.network/api is part of the docs site (same theme, navigation and search, English and Turkish): an overview of
  every public HTTP interface and one reference page per API, generated from the OpenAPI 3.1 files at build time. The YAML
  files stay downloadable under /api/.
- New OpenAPI definitions for the public registries: trust lists, status lists, schema catalogue. The Tamga Verify definition
  matches the service (`spec_version`, `sdk_version`, `freshness`, `status.reason`, QR image and page kit endpoints).
- The public repository contains only what is needed to build and test the packages and services and to build the two sites;
  the root documents are in English.

### 2026-10-08 — packages: 0.2.0 test release

- The `@tamga-network/*` packages are versioned `0.2.0` (test release); later test rounds are `0.2.x`/`0.3.0`, and `1.0.0`
  comes when everything is ready. The verification result's `sdk_version` is `@tamga-network/verifier@0.2.0`.

### 2026-10-08 — no age limit

- The network sets no age limit, neither for listed wallets nor for the identity service; the condition is identity
  verification with a valid identity document, and each issuer decides eligibility for its own credentials.

### 2026-10-07 — hardening

- Packages: externally signed lists with JAdES `crit` load (federation); an array element request discloses only that
  element; expired credentials fail at step A7; status lists have size limits, a required `exp` and a bound on future `iat`;
  WUA/WIA `exp` is required; list version memory and `previous_version_hash` check; stricter intermediate certificate checks;
  only active ZK circuits are accepted; stricter mdoc and COSE handling.
- Protocol: intermediary rule checked in the wallet in both directions; pass token `iat`/`exp` bounds; a ZK infrastructure
  failure is INDETERMINATE and WASM runs in a separate worker; PAR `redirect_uri` allowlist; request object `exp`/`aud`
  checks; size limits; `release.yml` input injection closed.
- Services: only referenced certificates are published under `keys/`; result details only with the status token; rate limits
  (429 + `Retry-After`); sandbox PKI and lists in setup and CI.

### Documentation

- Tamga ARF 1.0: the Architecture and Reference Framework, Annex A — Trust Framework, Annex B — Tamga Rulebook with the
  credential-type rulebooks (Education, Identity, Event Ticket), Annex D — Definitions, Annex E — References, and the
  supporting pages Reading path, Roles and Onboarding.
- Developer docs in English and Turkish: guides (including the sandbox test network), concepts, specifications (credential
  format, SD-JWT VC, OpenID4VCI, OpenID4VP, verification pipeline and API, trust lists, status list, X.509 institutional
  identity, identity proofing, schema catalogue, wallet rules), decision records and a glossary.
- Sandbox: real identity verification steps, open to everyone with daily/monthly caps, and institution test accounts.

### Packages (`@tamga-network/*`, 0.2.0 test release)

- `core`, `trust`, `schemas`, `sd-jwt`, `mdoc`, `issuer` (+ `/client`), `verifier` (+ `/web`, `/zk`), `wallet-core`, `zk`.
- `zk`: wallet-side zero-knowledge proofs (Longfellow ZK) for mdoc — `/node` desktop prover, `/react-native` module (Android
  libraries for arm64-v8a, armeabi-v7a, x86_64; iOS pending). Its proofs pass `verifier/zk` end to end.
- `wallet-core`: wallet-generic parts only (WUA/WIA types, client attestation PoP, WIA status checks); DCQL `claim_sets` and
  `credential_sets`; a credential is never presented with missing claims (`matchDcql` returns `gaps`); key access policy
  (phone lock for credential keys, non-interactive signing for background flows); separate pass keys.
- `schemas`: `urn:tamga:id:DrivingLicenceAttestation:1` — verified driving licence information (not an official driving
  licence or mDL; the always-visible `not_official_licence` claim says so).
- `trust`: optional `test_institution` on sandbox issuer entries.
- `verifier/web`: "Open in your wallet" button.

### Services

- Trust list publisher (`trust.tamga.network`), reference verifier (Tamga Verify, `verify.tamga.network`), sandbox test network
  (`sandbox.tamga.network`).
- The network operates no wallet: the wallet provider service left this repository; trust lists keep a reserved entry for
  Tamga Wallet's provider until it supplies its certificate.
