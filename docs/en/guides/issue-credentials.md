---
document_id: GUIDE-0003
title: "Issue credentials as an institution"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  Issuing credentials to people's wallets as a university, a public body or a ticket seller: calling the issuer service hosted
  by Tamga with `@tamga-network/issuer/client` (offers, ticket sales, revocation/suspension), or building your own issuer
  service with the `@tamga-network/issuer` library. External access uses a scoped API key per institution (ADR-0016).
translation_of: GUIDE-0003
source_version: 1.0.0
---

# Issue credentials as an institution

This guide is for developers at institutions ([[t:issuer|issuers]]) that want to issue credentials to people's wallets: a
university (diploma, student certificate), a public body or a ticket seller.

**When to read:** once your institution has decided to join Tamga, before you start the integration. For the ideas, see
[Issuance](/concepts/issuance); for working code, [[GUIDE-0004]] §3.

## How it works

1. Your institution creates an **offer** (a credential offer): "we will issue this credential to this person". The offer is a
   link or a QR code.
2. The person opens the offer with the wallet; the wallet fetches the [[t:credential]] from the institution with
   [[t:OpenID4VCI]].
3. The credential is signed with your institution's key and bound to the key on the person's device ([[t:holder-binding]]); it
   is useless on any other device.
4. If needed, you revoke or suspend the credential ([[t:revocation]]); [[t:verifier|verifiers]] see this in the
   [[t:status-list]].

There are two ways:

| | Hosted service (the recommended start) | Your own service |
|---|---|---|
| Who runs it | Tamga (`issuer.tamga.network/<institution>`) | you |
| What you install | `@tamga-network/issuer/client` (no dependencies, `fetch`) | `@tamga-network/issuer` (+ trust, schemas, sd-jwt) |
| Signing key | your KMS in the pilot (demo: development PKI, deviation S-1) | yours |
| Trust list entry | the Tamga operator: institution entry, category (e.g. `EDUCATION`, `EVENTS` — [[ADR-0014]]), schema authorisations | the same |

## Hosted service: the client

```ts
import { createIssuerClient } from "@tamga-network/issuer/client";

const tamga = createIssuerClient({ baseUrl: "https://issuer.tamga.network", slug: "bubilet", apiKey: process.env.TAMGA_API_KEY! });

// You sold a ticket → an offer to the wallet (no personal data in the ticket)
const sale = await tamga.sellTicket({ eventId: "EVT-2026-KONSER-01", ticketClass: "STANDARD" });
// sale.offer.deepLink → a QR code or an "open in wallet" link
// sale.offer.txCode   → over a SEPARATE channel (SMS, email, till screen) — NEVER over the same channel as the offer link (S5)

// A credential for a registered person — recommended: an identity-bound offer (no PIN; only the offer's owner can take it, ADR-0020)
const bound = await tamga.createBoundOffer({
  subjectId: "s-1001", // the opaque person identifier in your own system
  vct: "urn:tamga:edu:DiplomaCredential:1",
  bind: { personalAdministrativeNumber: tckn, birthDate: "2002-05-14" }, // Tamga stores only a keyed digest
});
// bound.deepLink → send it to the person over YOUR OWN channel (email, student portal); 7 days, single use

// Fallback: an offer with a PIN for a person without an identity credential
const offer = await tamga.createOffer({ subjectId: "s-1001", vct: "urn:tamga:edu:StudentCredential:1" });

// Revoke / suspend / reinstate — takes effect in the next fixed-interval publication (S6)
await tamga.revoke(credentialId, "mezuniyet iptali");
```

Errors arrive as `IssuerClientError` (`status` + message). The key is kept **on the server only**; never put it in a browser.

Which of the three offer types?

- **Identity-bound offer (recommended):** the person shows the identity credential in the wallet, and Tamga matches it with the
  digest in the offer. No PIN needed.
- **Offer with a PIN:** the fallback for a person without an identity credential. The PIN is never sent over the same channel as
  the offer link.
- **Ticket:** carries no personal data; no identity is asked for.

### API key

The Tamga operator creates a scoped key for your institution (`tmg_<slug>_…`; e.g. only `tickets:write` +
`revocations:write`) and hands it over once through a secure channel; the server keeps only its digest ([[ADR-0016]]).

- A key is valid for 90 days. To rotate it, a new key is created, you switch, and the old one is revoked (both are valid for a
  while).
- Calls go to `https://issuer.tamga.network/{slug}/api/v1/…`; there is a per-minute limit per key (`429` if exceeded).
- Scopes: `offers:write`, `tickets:write`, `tickets:read`, `revocations:write`. Pilot institutions may also be asked for mTLS.

## Credential data from your system: the source endpoint

The [[t:authentic-source]] is your system (e.g. the student information system). Tamga does not keep credential data; at the
moment of issuance it asks your system's **source endpoint** with a signed request and does not store the answer
([[ADR-0020]]). Contract: `docs/api/institution-source.openapi.yaml`.

- `lookup`: when the person picks your institution in the wallet and presents their identity — a search by national identity
  number + date of birth.
- `fetch`: for identity-bound offers, at issuance and when copies are renewed — a read with your opaque person identifier.
- The request is a 60-second JWT signed with the [[t:access-certificate]] in Tamga's [[t:trust-list]] entry; check `aud`,
  `exp` and `jti`.
- Until the source endpoint is connected, you can test with the **sample source** in the Institution Console; never enter real
  personal data there for production.

The whole Tamga API: `docs/api/tamga-issuer-api.openapi.yaml`.

## Personal data and identity

- Use credential fields only for the credential; never write them to logs, URLs or the status list.
- If you need to match the person with your own record (diploma, student certificate), [[t:identity-proofing]] uses the
  **Tamga identity credential**: the wallet presents the identity credential, and Tamga matches it with the digest in the offer
  or with your source endpoint (`lookup`). You never talk to the identity provider (Didit) directly ([[ADR-0011]]).
- For credentials that need no personal data, such as tickets, do not ask for identity.

## In depth: your own service

`@tamga-network/issuer` provides credential creation, OpenID4VCI server helpers (offer, `tx_code`, `c_nonce`, proof of
possession verification), the Token Status List publisher and the anchor request; the protocol profile is
[[SPEC-PROTO-0001]]. Reference: the issuance service Tamga itself runs. Before you start, the
institution registration, schema authorisations and key management (KMS/HSM) are agreed with Tamga.

## Rules

| Code | What it says |
|---|---|
| [[SPEC-CRED-0003]] S5 | the status list is published at a fixed interval, even without changes |
| [[SPEC-CRED-0003]] S6 | no out-of-cycle ("urgent") publication; a revocation takes effect in the next publication |
| [[SPEC-CRED-0003]] S8 | the status list address is opaque; it encodes no year, department or cohort |
| DP1 | no personal data or credential content is written to the trust infrastructure |
