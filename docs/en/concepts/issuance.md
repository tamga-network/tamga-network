---
title: Issuance (OpenID4VCI)
---

# Issuance

The institution (the [[t:issuer]]) issues a credential to the person's wallet with **[[t:OpenID4VCI]] 1.0** (the EU profile
[[t:HAIP]] 1.0). There are two ways to start.

## 1. The institution makes an offer (QR code or link)

The institution creates a **credential offer**; the person scans the QR code with the wallet or taps the link. The offer is
standard (`openid-credential-offer://`). In a pre-authorized offer the one-time 6-digit code (`tx_code`) is **mandatory**: on
the institution's screen it is shown with the QR code to the signed-in person; if the offer goes by e-mail, the code comes
through another channel (SMS). An identity-bound offer from the institution has no code; the person presents the verified
identity in the wallet instead.

## 2. The person asks from the wallet

In the wallet the person picks their university from the list of institutions and asks for the credential. The institution
knows that the requester really is that person **because the verified identity in the wallet is presented**; there is no
matching by name or number. The credential data is read from the institution's own system (the [[t:authentic-source]]) at the
moment of signing; Tamga keeps no register of people.

## Wallet attestations

When receiving a credential, the wallet presents a short-lived [[t:WIA]] signed by the [[t:wallet-provider]] that built it, and
a [[t:key-attestation]] showing that its keys are kept in secure hardware. The institution checks them against the wallet
providers in the [[t:trust-list]]; no credential is issued to a wallet from a provider that is not on the list.

## The flow at a glance

```
wallet                         institution (issuer.tamga.network/{institution})
  │  metadata  ───────────────▶  /.well-known/openid-credential-issuer/{institution}
  │  PAR + authorisation (DPoP) ▶  identity matching / offer code
  │  token  ──────────────────▶  wallet attestation check
  │  credential (proof) ──────▶  signature; entry in the status list
  │  ◀───────────────────────  SD-JWT VC (+ mdoc for identity), batch copies
```

## Your own service or the hosted one?

- **Hosted service:** `issuer.tamga.network/{institution}`; your institution creates offers from its own systems with an API
  key and manages credentials in the Institution Console. Guide: [[GUIDE-0003]].
- **Your own service:** with [`@tamga-network/issuer`](/packages/issuer); you register in the trust list as an issuer.

## Details

- Protocol: [[SPEC-PROTO-0001]]
- Status list: [[SPEC-CRED-0003]]
- API: [Hosted issuer API](/api/issuer)
