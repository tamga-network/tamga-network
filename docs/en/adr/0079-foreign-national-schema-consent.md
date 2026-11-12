---
document_id: ADR-0079
title: "Authorisation for another state's national schema: consent of the state that owns the schema"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  When a state authorises its own institution for a schema, the contract only checks that the institution belongs to that state
  and that the schema is registered; it does not check whose schema it is. A state can therefore authorise its institution for
  another state's national schema on its own. Decision: this authorisation can be given only with the consent of the state that
  owns the schema. The consent is an explicit record per schema (schema, state receiving the authorisation, time window), kept in
  the cross-recognition contract and tied to the schema owner recognising that state. Network schemas are outside this rule.
  Implementation is deferred: it is done before a second state joins.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0007]]", "[[ADR-0054]]", "[[ADR-0073]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0079
source_version: 1.0.0
---

# In short

Each state defines its own credential types (its national schemas): for example a state's equivalence certificate. Which type of
credential an institution may issue is decided by the institution's own state. In today's contract these two rules are not
connected: a state can write, for its own institution, an authorisation to issue another state's national credential type, and
verifiers treat that credential as valid. This decision puts the consent of the state that owns the schema in between: without
consent the authorisation cannot be written.

# Context

- [[ADR-0007]]: schemas have two tiers. **Network schemas** are registered by Governance vote and are open to all members.
  **National schemas** belong to one state; their `vct` is in that state's namespace (`urn:tamga:<cc>:…`, [[ADR-0054]] NS1).
- The institution–schema authorisation is given by the state that registered the institution
  (`IssuerRegistry.setSchemaAuthorization`). Step C2 of verification looks at this authorisation.
- **Today's behaviour (contract audit 2026-11-11).** The authorisation function checks two things: whether the caller is a
  delegate of the institution's state (`onlyOwnerState`); and, when granting, whether the schema is registered in
  `SchemaRegistry` (`UnknownSchema`). It does **not** look at the schema's tier or at the state that owns it. Result: state A can
  authorise its own institution for state B's national schema without B knowing; C2 accepts that authorisation. The only tool B
  has is not to recognise A or that institution ([[SPEC-BC-0001]] §5): this protects only B's own verifiers, not third states
  that rely on B's schema.
- In the signed list phase there is one national list and one operator; the problem becomes real when a second state joins. The
  matter was awaiting a decision in [[SPEC-BC-0001]] §14 item 9.
- The sovereignty principle ([[ADR-0002]]): only a state changes that state's records. A national schema is that state's record;
  who may use the schema is its decision as well.

# Decision

- **K1 — Rule.** A state can authorise its own institution for another state's **national** schema only with the consent of the
  state that owns the schema. Without consent the authorisation write is refused.
- **K2 — Network schemas are out of scope.** Authorisation for the network schemas registered by Governance stays, as today, the
  decision of the institution's state alone; so does authorisation for the state's own national schema.
- **K3 — Consent is an explicit record per schema.** The consent record is a time window for the triple `(schema owner state,
  schema, state receiving the authorisation)`; only a delegate of the schema owner state writes and withdraws it. It is per
  state, not per institution: which of its institutions is authorised is the internal matter of the state receiving the
  authorisation.
- **K4 — Tie to cross-recognition.** The consent record is kept in the cross-recognition contract (`CrossRecognition`) and can be
  written only while the schema owner state recognises the state receiving the authorisation (recognition mode not `NONE`). If
  recognition is withdrawn the consent stops working as well; it does not need to be withdrawn separately.
- **K5 — Time rule.** Once consent is withdrawn no new authorisation can be written, and credentials issued after that moment
  fail C2. Credentials issued within the consent window stay valid: C2 looks at both the authorisation window and the consent
  window at the credential's `iat` (the same reading as [[ADR-0073]] K5).
- **K6 — List phase.** The list publisher applies the same rule: an institution in one national list is authorised for a `vct` in
  another state's namespace only with a consent record that has its counterpart in that state's list or in the network records.
  Today there is one national list, so no such authorisation exists and none is written.
- **K7 — Timing of the implementation.** Code does not change with this decision. The contract, the list publisher and the
  equivalence test are implemented **before a second state joins**; until then the single operator writes no authorisation of
  this kind. Names and interfaces are approved during implementation.

# Options considered

| Option | What | For | Against | Result |
|---|---|---|---|---|
| **(a) Explicit consent record per schema** | The schema owner state writes consent for `(schema, state receiving the authorisation)`; the authorisation write and C2 look at this record | Consent is visible, can be withdrawn one by one, and the time window protects the credential history; the present meaning of recognition does not change | A new record type and one more read (from the registry contract to the recognition contract) | **accepted** |
| (b) Schema scope in the recognition policy | A list of schemas is added to the existing recognition policy ("I recognise these categories of that state"); a national schema in the list counts as opened to that state | No new record type | Recognition answers "whose credentials do I accept"; "who may use my schema" is a different question. If the two share one list, changing one changes the other; schema-level recognition is already a separate open issue and would be decided indirectly this way | rejected |
| (c) Prohibition | No authorisation for another state's national schema at all | Simplest | Makes jointly recognised national types impossible (e.g. centres abroad that issue a state's exam certificate); asking for a network schema for each of them draws Governance into national matters | rejected |
| (d) Free, protection through recognition | Today's state | No code change | The schema owner protects only its own verifiers, not third states that rely on its schema | rejected |

The tie to cross-recognition (K4) does not merge the two options: consent is a separate record (a), but a state cannot open its
schema to a state it does not recognise. This way no forgotten consent stays open when recognition is withdrawn.

# Invariants

| Code | Rule |
|---|---|
| FS1 | A state can authorise its own institution for another state's national schema only with a consent record in force, written by the state that owns the schema for that state. Network schemas and the state's own national schemas are outside this rule. |
| FS2 | Only the state that owns the schema writes and withdraws the consent record; the record is per schema and per state receiving the authorisation, carries a time window, and is in force only while the schema owner state recognises the state receiving the authorisation. |
| FS3 | In verification, a credential issued with another state's national schema is accepted if, at the credential's `iat`, both the institution's schema authorisation and the schema owner's consent were in force; a later withdrawal of consent does not invalidate credentials issued before it. |

# Consequences

- **Implementation pending (before a second state joins).** To do: the consent record and its read in `CrossRecognition`; the
  consent check in the `IssuerRegistry` authorisation write and in `isCredentialSchemaAcceptable` (the schema's tier and owner are
  read from `SchemaRegistry`); events and the indexer; the list format and the publisher check; replay and the equivalence test;
  code size headroom. The storage layout only gets additions.
- Until then: the contract does not prevent this authorisation (today's behaviour, above). There is no running chain; in the
  list phase the single operator writes no such authorisation.
- [[SPEC-BC-0001]] §3.4 and §14 item 9: "decided, implementation pending".
- Schema-level recognition ([[SPEC-BC-0001]] §14 item 2) is not closed by this decision; it is a separate matter.

# Status

**Accepted — 2026-11-12.** Approved by project management (2026-11-12). DECISIONS: D-BC-15. FS1–FS3 are binding; implementation
is done before a second state joins.
