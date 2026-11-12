---
document_id: ADR-0080
title: "Two layers against a relayed identity verification link: final confirmation in the wallet and a warning before verification"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  The identity service hands identity verification over to an external identity verification provider. If an attacker starts the
  flow from their own wallet and relays the verification link to someone else, that person verifies with their own identity and
  the identity credential is issued to the attacker's wallet. The decision has two layers: (1) a final confirmation screen in the
  wallet that started the flow, before the credential is issued — the identity service returns a masked summary of the verified
  identity (initials of the given and family name, year of birth) to that wallet only, and no credential is issued until the
  person says "this is me"; (2) a warning to the person doing the verification, before it starts, that says which wallet it is
  for. Implementation is deferred: it is done before identity verification is opened to everyone.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0025]]", "[[ADR-0040]]", "[[ADR-0042]]", "[[SPEC-ID-0003]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0080
source_version: 1.0.0
---

# In short

To get a Tamga identity credential a person shows their identity document and their face on a verification page. The link to
that page can be sent to someone else. If a malicious person starts the process on their own phone and sends the link to another
person saying "verify your identity for your application", that person unknowingly hands their own identity to the attacker's
wallet. This decision adds two measures: before the credential is issued the wallet asks "this is the verified identity, is it
yours?"; and the verification page says at the very start "this verification is for the wallet on that phone; if you did not
open this link, do not continue".

# Context

- Identity verification happens only in the identity service ([[ADR-0011]], SPEC-ID-0003/IDP3). The flow: the wallet opens the
  authorisation request → the person reads the privacy notice on the identity service's page and consents (IDP11) → the identity
  service opens a session with the identity verification provider and redirects the person there → the person shows their
  document and face → the provider redirects the person back to the identity service → the identity service issues the
  authorisation code → the wallet exchanges the code for a token and requests the credential. The credential is bound to the
  hardware key of the wallet that started the flow.
- **Fix of 2026-11-11.** The authorisation code is now issued only with the single-use key in the provider's return address.
  Knowing the identifier of the flow is not enough; the code goes to the browser that finished the verification.
- **Remaining gap.** The link of the verification session (or the provider's "continue on another device" path) can be relayed.
  There is no technical tie between who does the verification and who started the flow: the provider says "this document is
  genuine and this face is the person on the document"; it does not say "this person owns the wallet that started the flow".
- In the real network identity verification is by invitation today, which is why the gap is limited today. Once access is opened
  to everyone the attack scales.

## Threat model

| | |
|---|---|
| Attacker | Has a real wallet on their own phone that passes device attestation. Starts the flow and gives consent themselves. Can send the victim a message and steer them with a plausible pretext (job application, prize, bank, parcel). |
| Victim | Has their own identity document and face; may have no wallet. Opens the link and sees a genuine identity verification page. Does not know they are giving an identity to a wallet. |
| Outcome of the attack | A genuine identity credential that carries the victim's identity and is bound to the attacker's device key. The attacker presents identity in the victim's name with it. |
| Out of scope | A person who knowingly lets someone else use their identity (not solved by a technical measure; the same as handing over one's identity). Forged documents and fake faces (the provider's job). A stolen phone (wallet lock and wallet unit revocation). |

The same gap exists in the opposite direction: a person starts the flow from their own wallet and a "helper" finishes the
verification with the helper's identity; someone else's identity enters the person's wallet.

# Decision

- **K1 — Layer 1: final confirmation in the wallet.** After verification ends and before the credential is issued, the identity
  service returns a **masked summary** of the verified identity to the wallet that started the flow, and to it only. The wallet
  shows the summary and asks: "This is the verified identity. Is this you?" The wallet does not request the credential until the
  person says "this is me"; the identity service does not issue a credential for a token without a confirmation record either.
  If the person says "this is not me", the flow closes, no credential is issued and the session at the provider is deleted.
- **K2 — Content of the masked summary.** Only the initials of the given name and family name and the year of birth (e.g.
  "A. K. · 1990"). The full name, national identity number, document number, day and month of birth and photograph are not part
  of the summary.
- **K3 — Layer 2: warning before verification.** Before verification starts, the first screen the person doing the verification
  sees carries this text: "This verification is for the wallet on *⟨device and wallet description⟩*. If you did not open this
  link, do not continue." The wallet's name comes from its record in the trust list (e.g. "Tamga Wallet"); the device description
  is a coarse label (e.g. the type of phone). If the provider's page cannot be customised enough to carry this text, the identity
  service's own interstitial page is placed in front of the provider.
- **K4 — Both together.** The layers do not replace each other (below). Identity verification is not opened to everyone before
  both are implemented.
- **K5 — Timing of the implementation.** Code does not change with this decision. Implementation is done **before access is
  opened to everyone**; until then identity verification in the real network stays by invitation. New field, endpoint and error
  names are approved during implementation.

## Why layer 1 is not enough on its own

In the main attack the question "is this you" is put to the wrong person: the wallet that started the flow is the attacker's, and
the attacker confirms. What layer 1 adds is this:

- It catches the opposite direction and honest mistakes: a person whose wallet is about to receive someone else's identity sees
  it from the initials and the year of birth.
- It forces the attacker into an explicit false statement ("this is me"); the event remains as an audit record that contains no
  personal data.

In the main attack the only honest party is the victim, and the only place they can be reached is the start of the verification.
That is what layer 2 is for. Layer 2 is not enough on its own either: warnings can be skipped unread, and the provider's page is
not under our control.

## Personal data assessment of the masked summary

- **It is personal data.** Even masked, it belongs to a specific person; the personal data rules apply in full (data is
  minimised and limited to the purpose).
- **Who sees it.** Only the wallet that started the flow, over the channel bound to that wallet's key (token and wallet instance
  key). It is not written to an address, query parameter or redirect.
- **Where it is kept.** The identity service derives the summary at that moment from the verified fields it would build the
  credential from; it does not store it separately. When the credential is issued or the flow closes it is deleted together with
  the person fields (IDP9). Only the event name goes to the log and audit record (summary shown, confirmed, declined); the summary
  itself is not written. The wallet only shows the summary on screen; it does not write it to the transaction log.
- **If it is shown to the wrong person.** In the main attack the victim's summary appears in the attacker's wallet. That is why
  the summary is narrow: enough for an honest person to recognise themselves, but of no gain to a stranger. The attacker usually
  already knows the name of the person they target; initials and a year of birth give neither an identity number nor a full date
  of birth. The full name, the day of birth and the photograph were left out for this reason.
- **Privacy notice.** The notice before consent (IDP11) mentions the final confirmation step and that the summary will be shown.
- **Device description in the warning.** A coarse label (type of phone, name of the wallet); it carries no serial number,
  persistent device identifier or location, and is kept only for the duration of the flow.

# Options considered

| Option | Result | Why |
|---|---|---|
| **Final confirmation in the wallet + warning before verification** | **accepted** | Works independently of the provider; stores no personal data; each layer covers the other's gap. Remaining risk below |
| Final confirmation in the wallet only | rejected | In the main attack the one who confirms is the attacker |
| Warning only | rejected | The warning may go unread; it does not catch the opposite direction or honest mistakes |
| Binding the provider session to the device (verification can be completed only on the device that started the flow) | not chosen now | Depends on the provider's capabilities. Putting a provider component inside the wallet violates the rule that the wallet does not know the provider (IDP3) and that the network operates no wallet ([[ADR-0042]]); it ties every conforming wallet to one provider. For verification done in a browser, "same device" cannot be proven reliably. If the provider offers such a setting it is reconsidered as additional hardening |
| Asking for the face match again on the wallet device (a live face from the wallet before issuance, matched with the face from verification) | not chosen now | Technically the strongest tie. But it requires keeping the face from verification, or its template, until the confirmation: that is special category personal data and contradicts the rule that images are not stored (IDP4, IDP9). On a device under the attacker's control the camera input can be faked (extra liveness checks needed); it adds a provider transaction per issuance and an accessibility burden |
| Issuing the identity credential only in person | rejected | Defeats the purpose of remote identity verification |

**Remaining risk (deliberate).** A determined attacker who persuades the victim to ignore the warning can succeed. This is the
same class as a person knowingly letting someone else use their identity. If the scale grows, the two paths above are taken up
again.

# Invariants

| Code | Rule |
|---|---|
| VL1 | The identity credential is not issued until the person, in the wallet that started the flow, has seen the masked summary of the verified identity and confirmed "this is me". Without confirmation, or if the person declines, no credential is issued, the flow closes and the session at the provider is deleted. |
| VL2 | The masked summary consists only of the initials of the given name and family name and the year of birth; it is returned only to the wallet that started the flow, over the channel bound to that wallet's key; it is not written to an address, the log or the audit record and is not kept after the flow ends. |
| VL3 | Before identity verification starts, the person doing the verification is shown which wallet the verification is for and that they must not continue if they did not open the link themselves. If the provider's page cannot carry this text, the identity service's own interstitial page is placed in front of the provider. |
| VL4 | Identity verification in the real network is not opened to everyone before VL1–VL3 are implemented. |

# Implementation plan

The code is not in this repository for the most part but in the identity service (operator repository) and in wallet
applications.

1. **Identity service.** (a) Masked summary: derived from the verified given name, family name and date of birth (initial rule
   for Turkish and non-Latin letters; persons with a single name). (b) Returning the summary to the wallet that started the flow:
   in the token response or at a separate endpoint bound to the token; not written to an address. (c) Confirmation record: the
   credential endpoint refuses a token without a confirmation record with an explicit error; on decline the flow closes and the
   provider session is deleted. (d) Warning: on the provider's page if its customisation is sufficient; otherwise the service's own
   interstitial page. The interstitial only helps if the link that can be relayed passes through it: the provider session is
   opened when the person presses "continue" on the interstitial, and with a short lifetime; whether the provider's session link
   can still be relayed after that is tested together with the provider's capabilities and recorded as remaining risk. (e) Audit
   record: event names only. (f) Tests: relayed link scenario, decline, credential request without confirmation, page reload.
2. **Wallet core (`@tamga-network/wallet-core`) and the wallet application.** The issuance client hands the summary to the
   application and sends no credential request without confirmation; the application shows the final confirmation screen ("this
   is me" / "this is not me"); the summary is not written to the log. For conforming wallets the rule is added to
   [[SPEC-WALLET-0001]] and the wallet checklist.
3. **Specifications.** SPEC-ID-0003 (flow and rules), [[SPEC-PROTO-0001]] (the extra step in the identity service's issuance
   flow).
4. **Texts.** The final confirmation screen, the warning and the addition to the privacy notice in Turkish, English, Azerbaijani
   and Turkmen.
5. **Order.** The identity service and the wallet are released together; because an older wallet version could not request a
   credential without confirmation, the minimum wallet version is raised through the wallet's record in the trust list.

# Status

**Accepted — 2026-11-12.** Approved by project management (2026-11-12). DECISIONS: D-ID-15. VL1–VL4 are binding; implementation
is done before identity verification is opened to everyone.
