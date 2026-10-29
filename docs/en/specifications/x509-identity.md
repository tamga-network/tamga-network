---
document_id: SPEC-ID-0002
title: "Institutional identity (X.509)"
status: Active
version: 1.0.0
created: 2026-08-06
last_updated: 2026-10-29
summary: >
  The code- and protocol-level counterpart of the X.509 decision ([[ADR-0004]]). Institutional (entity) identity is built on
  X.509 certificates rooted in national Root CAs; an institution's ledger identity is anchored as
  issuerId = keccak256(stateCode, certFingerprint). Covers: the chain of trust (anchoring national Root CAs), the certificate
  hierarchy, issuerId derivation, the credential verification algorithm (chain + registry + revocation), Root CA rollover,
  certificate revocation (CRL/OCSP + registry), guardian/court-token X.509 binding, the retained pseudonym profile +
  multicodec, and the eIDAS/did:web bridge. Replaces the did:tamga entity profile; the pseudonym profile (SPEC-ID-0001)
  is retained.
translation_of: SPEC-ID-0002
source_version: 1.0.0
---
**This specification describes how the identity of [[t:issuer]] institutions is established and verified with X.509 certificates.** It is for developers integrating institutions and writing a [[t:verifier]].

**When to read**

- Read the concept page [Trust lists and federation](/concepts/trust-lists) first.
- When you need to trace a credential's signature to the institution's certificate and from there to the country's root certificate.
- Next: [[SPEC-TRUST-0001]] for the format of the trust lists.

**In brief.** Every country runs its own root certificate (Root CA). An institution, for example a university, obtains a
certificate chained to this root and signs credentials with it. A verifier follows the signature to the institution's
certificate and from there to the root certificate; today the root's fingerprint is published in signed
[[t:trust-list|trust lists]] (in the chain stage the same record moves to the ledger). The institution's identity in the
network (`issuerId`) is derived from the country code and the certificate fingerprint. An institution's authority can be
revoked both at certificate level and in the trust list.

---

# Scope

This specification defines how **institutional (entity) identity** is established in Tamga Network with X.509 certificates
([[ADR-0004]]). It gives the **how**, not the **what**: Root CA anchoring, certificate → `issuerId` mapping, the verification
algorithm, revocation and rollover. It **replaces the entity DID profile** of SPEC-ID-0001; **the pseudonym profile is
retained** (see §7).

**Three layers ([[PM-AUTH-0001]]):** A = EVM address (out of scope of this document, unchanged) ·
**B = institutional identity (the subject of this document, X.509)** · C = personal identity (credential + pseudonym, §7).

---

# 1. Chain of trust: anchoring national root certificates (Root CA)

Every member state runs **its own national Root CA** (sovereignty — [[ADR-0002]]). Tamga **anchors the fingerprints** of
these roots on the ledger, so an institution's certificate can be verified up to its state's anchored root.

```
Türkiye Root CA  (fingerprint on the chain, stateCode="TR")
   └── (optional intermediate CA)
         └── İTÜ certificate  (leaf)
```

**On-chain root record** (RootCARegistry — same governance as [[SPEC-BC-0001]], `onlyOwnerState`):

```solidity
struct RootCA {
    bytes2  stateCode;      // "TR", "AZ", "KZ"
    bytes32 caFingerprint;  // SHA-256(DER(rootCert))
    uint64  notBefore;
    uint64  notAfter;
    bytes32 successorId;    // rollover successor (0 if none)
    RootStatus status;      // ACTIVE, ROLLING_OVER, RETIRED, REVOKED
}
```

Only **that state** registers/updates its root (`onlyOwnerState`). The root's **public key** is kept on the chain (it is not
personal data — the [[PM-TRUST-0001]] boundary holds).

## 1.1 Institution certificate profile ([[ADR-0050]])

The credential signing and status list signing certificates of issuing institutions (the identity service included) follow ETSI
TS 119 412-6 V1.2.1 and EN 319 412-3:

| Field | Rule |
|---|---|
| Subject | `organizationIdentifier` (2.5.4.97) mandatory, the same as the registration certificate's `sub` (`VATTR-<tax number>`, `NTRTR-<MERSİS>`, `LEIXG-<LEI>`); `O` = the institution's legal name; `C` mandatory; `CN` and `OU` optional |
| Key usage | Critical; `digitalSignature` only (a single type; compatible with the mdoc document signer certificate) |
| Basic constraints | Critical, `cA = false` |
| SKI / AKI | Both mandatory; AKI = the SKI of the signing authority |
| AIA | Not needed for non-qualified EAA; the qualified and public classes by a separate decision |
| Algorithm, validity | P-256 / ECDSA SHA-256; at most 3 years |

On the production network an institution certificate is issued with `organizationIdentifier` (operator tool `pki-issue --prod
--org-id`); older certificates without an identifier are renewed when the identifier is entered into the registration (renewal
pattern of §4, XC2). The sandbox certificates were re-signed with the same key (2026-10-13).

---

# 2. issuerId derivation

An institution's ledger identity is derived **deterministically** from the certificate fingerprint:

```
certFingerprint = SHA-256( DER(issuerCert) )
issuerId        = keccak256( abi.encodePacked(stateCode, certFingerprint) )
```

`issuerId` is the record key in the [[SPEC-BC-0001]] **Issuer Registry**:

```solidity
struct Issuer {
    bytes2        stateCode;
    bytes32       certFingerprint;
    IssuerCategory category;   // GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER, EVENTS (ADR-0014)
    uint64        validUntil;
    bytes32       successorId; // soft revocation / renewal successor
    IssuerStatus  status;      // ACTIVE, SUSPENDED, REVOKED
}
```

When the same institution renews its certificate, the fingerprint changes → a new `issuerId`; the old record is linked to the
new one with `successorId` (uninterrupted continuity; the [[SPEC-BC-0001]] soft-revocation pattern).

---

# 3. Credential verification algorithm

A verifier verifies a [[t:credential]] presented by a [[t:holder]] as follows:

```
INPUT: credential (SD-JWT signed by the issuer), issuerCert (in the credential / reachable)

1. Certificate chain: verify issuerCert → (intermediate CA) → up to the Root CA.
   Is the root's caFingerprint ACTIVE|ROLLING_OVER in RootCARegistry? If not, REJECT.
2. issuerId = keccak256(stateCode, SHA-256(DER(issuerCert))).
   Is it in the Issuer Registry with status == ACTIVE? Is the category the expected one? If not, REJECT.
3. Temporal validity: issuerCert.notAfter not passed + validUntil not passed.
4. Revocation:
   a. Institution level: X.509 CRL/OCSP clean + on-chain Issuer.status != REVOKED.
   b. Credential level: the StatusList bit is "valid" ([[SPEC-BC-0001]], min 100k).
5. Signature: the credential signature is valid under the issuerCert public key.
   → if all 5 steps pass, the credential is VALID.
```

**Note:** steps 1–3 are read from the registry (public); no credential or personal data goes to the chain. Verification is
done **without calling back** the issuer (holder-centric).

---

# 4. Root certificate rollover

A national root is renewed on expiry or to strengthen the key. Without breaking existing credentials:

1. The state registers the new root; the old root gets `status = ROLLING_OVER`, `successorId = newRoot`.
2. **Overlap period** (e.g. 12 months): both roots are accepted for verification.
3. Institutions move their certificates to the new root (new `issuerId` + `successorId` chain).
4. At the end of the overlap the old root is `RETIRED`; only the new root is accepted.

**Emergency (root compromised):** the old root becomes `REVOKED` → every certificate chained to that root is invalid at once;
the state concerned runs an emergency re-issuance. This has a wider effect than revoking an institution ([[SPEC-BC-0001]])
and is defined in governance ([[PM-GOV-0001]], planned).

---

# 5. Certificate revocation (two layers)

| Layer | Mechanism | What it revokes |
|---|---|---|
| **Institution certificate** | X.509 CRL/OCSP **+** on-chain `Issuer.status = REVOKED` | All future signatures of the institution |
| **Single credential** | StatusList bit ([[SPEC-BC-0001]]) | Only that credential |

Hybrid approach: the existing CRL/OCSP infrastructure of the X.509 world (regulatory compliance) + on-chain status
(holder-centric, verifiable without going to the source). In a conflict, **on-chain REVOKED is binding** (the chain is the
single source of truth).

---

# 6. Guardian and court-token binding ([[SPEC-BC-0002]])

In accountable disclosure, guardian institutions and the court are **identified with X.509**:

- Guardian `entityId` = the `issuerId` of the institution concerned (judiciary, data protection authority, civil registry,
  Ombudsman, parliament-appointed → each an X.509-certified institution).
- **Court-token** = a signed object (JWS or EIP-712); its signature chains to the court's X.509 certificate and from there to
  the national Root CA. On-chain verification: `verifyCourtToken` checks the fingerprint + chain + registry ACTIVE.
- Guardian approvals (3-of-5) are each made with an X.509 signature; the audit log keeps the signature fingerprints (not
  personal data).

> This is the concrete counterpart of the "x509 to be tracked" item closed in [[SPEC-BC-0002]] §7. Whether the court-token is
> EIP-712 or JWS + the need for an EVM precompile → [[DECISIONS]] D-GRD-1 (crypto review).

---

# 7. Retained pseudonym profile (citizen)

**Citizens are not given a global identifier.** Personal relationships are established with **pairwise [[t:pseudonym|pseudonyms]]**
(SPEC-ID-0001 pseudonym profile — **not affected** by the X.509 decision):

- Pseudonym = self-certifying, key-based; different and unlinkable in every relationship.
- It is **not written** to the chain; resolution is from the local key.
- **Multicodec set (fixed):** `p256-pub` (0x1200), `secp256k1-pub` (0xe7), `ed25519-pub` (0xed). Default **P-256**
  ([[t:eIDAS]]/[[t:QSCD]] alignment); secp256k1 for EVM-native operations.
- The entity ↔ pseudonym bridge exists only through accountable disclosure ([[SPEC-BC-0002]]).

---

# 8. eIDAS / did:web bridge (optional interoperability)

For interoperability with the EU, an institution can **alias** its existing identity to its Tamga `issuerId`:

- **eIDAS QWAC/QSeal:** the institution's qualified certificate is already X.509 — directly suitable for deriving an
  `issuerId`; cross-recognition with the EU Trusted List ([[t:LOTL]]) ([[ADR-0002]] cross-recognition).
- **did:web:** the institution's `did:web` identity can be bound to the `issuerId` with an alias record (not mandatory; only if
  interoperability with DID-based external ecosystems is needed).

This bridge is **one-way recognition**; Tamga's core chain of trust is the national Root CAs.

## 8.1 ETSI TS 119 612 XML list view ([[ADR-0066]])

> Basis: [[ADR-0066]] (2026-10-29; [[RS-EIDAS-0001]] §5.1, ETSI TS 119 612 V2.4.1). The EU's signature validation tools and the
> Commission's interim path for third countries (TC AdES LOTL) expect the national list in this XML format. Tamga's own XML list
> does **not** enter that list (it is for the signature and seal certificate providers supervised by a state); the gain is a ready
> tool and template for a state, and EU tools being able to read the Tamga list as XML too.

**Principle:** the authoritative source is the signed Tamga country list ([[SPEC-TRUST-0001]]). The list publisher
(`apps/trust-publisher`, `build`) generates a XAdES-B-B signed view from the same signed `tl-<cc>` object and the LOTL, **with the
same version** (`TSLSequenceNumber` = `version`): `tl-<cc>.xml`, `tl-<cc>.sha2` and `archive/tl-<cc>.vNNNN.xml`. The XML cannot
contain a record that is not in the JSON; in a conflict the JSON prevails. Tamga is the provisional scheme operator (TLSO) of this
list; when a state takes over a slot the URI set can change per slot, the records and identifiers do not.

**URI profile (a Tamga root that claims nothing, `https://trust.tamga.network/tl/`):**

| Field | URI |
|---|---|
| `TSLType` | `…/tl/TSLType/<CC>list` |
| `StatusDeterminationApproach` | `…/tl/StatusDetn/<CC>determination` |
| `SchemeTypeCommunityRules` | `https://arf.tamga.network/trust-framework` + `…/tl/schemerules/<CC>` |
| `SchemeInformationURI` | `…/tl/` + the `archive/` address of the publication point |

ETSI URIs that claim "notified by a Member State" or "qualified" status in the EU sense (`EUgeneric`, `EUappropriate`, `granted`,
`recognisedatnationallevel`, `…/QC`, `…/NationalRootCA-QC`) are **not used** (TX2). The meaning of the URIs is defined on the
[ETSI XML trusted list](/en/concepts/etsi-trusted-list) page.

**Service type mapping (Tamga record → `ServiceTypeIdentifier`):**

| Tamga | URI | Note |
|---|---|---|
| National root CA (`root_cas`) | `http://uri.etsi.org/TrstSvc/Svctype/CA/PKC` | Non-qualified certificate-issuing service (§5.5.1.2) |
| Issuer — no class or general | `http://uri.etsi.org/TrstSvc/Svctype/EAA` | Non-qualified EAA issuance |
| Issuer — public source (PuB-EAA equivalent) | `…/tl/Svctype/EAA/Pub-EAA` | Tamga root: an ETSI URI would carry a claim |
| Issuer — accredited in Tamga (QEAA equivalent) | `…/tl/Svctype/EAA/Q` | Tamga root; not qualified in the EU sense |
| Issuer's status list signature (`delegate_keys`, purpose `status_list`) | `…/tl/Svctype/EAA/StatusList` | Separate service, separate certificate |
| Wallet provider solution (LOTL `wallet_providers`) | `http://uri.etsi.org/19602/SvcType/WalletSolution/Issuance` | TS 119 602 type (same as the LoTE) |

**Not in the list:** verifiers (they are not trust service providers; their records are in the JSON list and in registration
certificates — [[ADR-0026]]), `RESERVED` / `PROVISIONAL` records, personal data (XC3, XC4).

**Status mapping (Tamga status → `ServiceStatus`, one to one):**

| Tamga status | `ServiceStatus` |
|---|---|
| `ACTIVE` | `…/tl/Svcstatus/active` |
| `SUSPENDED` | `…/tl/Svcstatus/suspended` |
| `REVOKED` | `…/tl/Svcstatus/revoked` |
| `RETIRED` | `…/tl/Svcstatus/retired` |
| `ROLLING_OVER` | `…/tl/Svcstatus/rollingover` |
| `DEPRECATED` | `…/tl/Svcstatus/deprecated` |

Records are not deleted: an inactive service stays with its status; earlier statuses are in `ServiceHistory`, newest first, with
the SKI instead of the certificate (§5.5.10, §5.6.3). A reader that does not know these URIs does not treat the service as active
(safe side).

**Signature and signer:** XAdES-B-B, enveloped (`URI=""`, enveloped-signature + Exclusive C14N), SignedProperties (SigningTime,
SigningCertificateV2, DataObjectFormat), only the signer certificate in KeyInfo; ECDSA P-256 / SHA-256. The signer is a separate XML
signing certificate (`tl-xml-signer-1`, a leaf issued by the root) and follows the §5.7.1 profile: subject `C` = slot country
code, `O` = `SchemeOperatorName`; basicConstraints CA=false; keyUsage only digitalSignature + nonRepudiation; SKI and AKI;
extendedKeyUsage `id-tsl-kp-tslSigning` (0.4.0.2231.3.0). Its fingerprint is among the slot's signing keys in the LOTL. On the real
network no XML is published with a non-conforming signer or with missing publication data (operator, institution and wallet
provider postal addresses) (TX3).

**Publication:** flag `TAMGA_TL119612` (off by default, TX5). On in the sandbox (`trust.sandbox.tamga.network/tl-tr.xml`, with
placeholder addresses marked "TEST"); on the real network (`trust.tamga.network/tl-<cc>.xml`) once the postal addresses are in place.
The server serves `.xml` as `application/vnd.etsi.tsl+xml` and `.sha2` as `text/plain`, with a cache of at most 4 hours (§6.1,
§6.2).

**Old mapping removed (2026-10-29):** the table in the previous version of this section (issuer → `CA/QC`, `ACTIVE` → `granted` /
`recognisedatnationallevel`, `NationalRootCA-QC`) claimed qualified service status in the EU sense and was removed by
[[ADR-0066]]; Tamga's issuers are not qualified ([[ADR-0022]]).

### 8.1.1 LoTE projection (ETSI TS 119 602, JSON)

[[t:ARF]] 3.0 requires wallets and verifiers to take their [[t:trust-anchor|trust anchors]] both from 119 612 TLs and from
119 602 [[t:LoTE|LoTEs]] (OIA_15b, ISSU_10b, ISSU_28a). `apps/trust-publisher` `build` produces three LoTEs from the
[[SPEC-TRUST-0001]] lists (`trust.tamga.network/lote/{wallet-providers,wrpac-providers,eaa-providers}.jws`): Annex A.1 JSON
schema, compact JAdES Baseline B (`x5c`, `x5t#S256`, signing time in `iat` — ETSI TS 119 182-1 V1.2.1 §5.1.11; `sigT` is not used in new signatures since 2025-07-15, the reader still accepts it in older lists), the same list signer (certificate C/O =
SchemeTerritory / SchemeOperatorName, §6.8.0).

- Profile: the EU Annex E / Annex F rules and the Annex H structure. However, instead of URIs that mean "notified by a member
  state" (LoTEType, StatusDetn, schemerules, ListOfTrustedEntities/…/CC), the Tamga URI root
  `https://trust.tamga.network/lote/` is used (Annex C.1).
- Service type URIs are ETSI's (`SvcType/WalletSolution`, `SvcType/WRPAC`). There is no ETSI type for non-qualified EAA; a
  Tamga URI is used.
- A LoTE is a view; the authoritative source is the Tamga lists. Publication is enabled in the source with `lote.enabled`.

**Open ends:** a multi-state country code for the Turkic world (ETSI §5.1.5, similar to GCC/ASEAN) and the TL publication
cadence (≤6 months, noisy republication — aligned with [[ADR-0008]]) → §10.

---

# 9. Key algorithms and invariants

- **Signature:** ECDSA **P-256 (secp256r1)** primary (eIDAS/QSCD compliance); secp256k1 accepted for EVM-native operations.
  Certificates use SHA-256 digests.

**Invariants:**

| # | Invariant |
|---|---|
| **XC1** | Institutional identity always chains to its state's anchored Root CA. |
| **XC2** | `issuerId` is bound to the certificate fingerprint; when the certificate changes, the identity continues with a new `issuerId` + `successorId`. |
| **XC3** | The chain holds only non-personal data (root/institution public key, status). |
| **XC4** | A citizen has no global identifier (only pairwise pseudonyms). |
| **XC5** | The entity ↔ identity link is resolved only through the accountable-disclosure threshold. |
| **XC6** | The credential and status list signing certificate of an issuing institution carries in its subject the same `organizationIdentifier` as the registration certificate's `sub`; key usage is critical and `digitalSignature` only; SKI and AKI are mandatory ([[ADR-0050]]). |

---

# 10. Open questions

1. **Intermediate CA policy:** will states use intermediate CAs, or will leaves be signed directly by the root? (chain
   length / verification cost)
2. **Overlap period** (rollover) — 12 months proposed; settled with the states → PM-GOV-0001.
3. **Court-token format** (JWS vs EIP-712 + precompile) → [[DECISIONS]] D-GRD-1.
4. **OCSP stapling vs on-chain status** — which is primary; performance/compliance balance.
5. How the **CAIP-2 network identifier** (`tamga:<chainId>`) appears in the certificate/issuerId representation.
6. ~~**119 612 TL projection format**~~ ✅ [[ADR-0066]] (2026-10-29): the list publisher produces XML/XAdES-B-B with a separate
   §5.7.1 signer (§8.1). The signing key rollover order (≥2 rolling certificates, ETSI Annex A.2) is open → PM-GOV-0001.
7. Will a **multi-state country code for the Turkic world** (ETSI §5.1.5) be defined → [[ADR-0002]].
8. How is the **TL publication cadence** (≤6 months, noisy republication) combined with status list publication
   ([[ADR-0008]]).

---

# 11. Relationships and status

- [[ADR-0004]] — the decision behind this specification (X.509).
- SPEC-ID-0001 — entity profile superseded; **the pseudonym profile is retained in this document**.
- [[SPEC-BC-0001]] — Issuer Registry / StatusList / IssuerCategory (issuerId data source).
- [[SPEC-BC-0002]] — guardian/court-token X.509 binding (§6).
- [[ADR-0002]] — onlyOwnerState / cross-recognition (Root CA ownership, eIDAS bridge).
- [[PM-AUTH-0001]] — rationale for the three layers + regulator readability.
- [[RS-EIDAS-0001]] — §5.1 (ETSI 119 612 Trusted List analysis) = the basis of the §8.1 projection.
- Implementation: `sdk/` (resolver + verification), `apps/trust-publisher/src/tl119612.ts` (119 612 XML view, [[ADR-0066]]),
  `contracts/src/` (RootCARegistry).

**In force** — version 1.0.0 (2026-10-02; §1.1 and XC6 on 2026-10-13, [[ADR-0050]]; §8.1 on 2026-10-29, [[ADR-0066]]).

---
