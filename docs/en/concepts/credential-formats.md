---
title: Credential formats
---

# Credential formats

Tamga [[t:credential|credentials]] are issued in two standard formats. Both are the formats of the EU digital identity
wallet.

| | SD-JWT VC | ISO mdoc (ISO/IEC 18013-5) |
|---|---|---|
| Where | Presentation over the internet (website, employer, institution) | In-person presentation (gate, turnstile, counter) and identity |
| Structure | JSON; every field can be withheld on its own | CBOR; fields in namespaces, with signed digests |
| Type | `vct` = `urn:tamga:<domain>:<Type>:<version>` | `docType` |
| Holder binding | `cnf` key; a device signature with every presentation (KB-JWT) | device key; a device signature bound to the session |

The identity credential is issued in both formats ([[t:SD-JWT-VC]] and [[t:mdoc]], bound to the same device key); the other
credentials are SD-JWT VC today. The device signature, a [[t:KB-JWT]], proves that the credential is bound to the key on that
phone ([[t:holder-binding]]).

## Credential types and the catalogue

The definition of every credential type (display names, fields, which fields can be withheld) and its JSON Schema are in the
catalogue at `https://schemas.tamga.network/v1/catalogue.json`. A credential is bound to its type definition ([[t:vct]]) by the
`vct#integrity` digest; the verifier checks that the definition has not changed.

| Type | Issued by |
|---|---|
| `urn:tamga:edu:StudentCredential:1` | university |
| `urn:tamga:edu:DiplomaCredential:1` | university |
| `urn:tamga:id:IdentityAttestation:1` | identity service (provisional, until the state identity credential arrives) |
| `urn:tamga:tkt:EventTicket:1` | ticket seller |
| `urn:tamga:contact:EmailAddress:1`, `PhoneNumber:1` | identity service |

## Details

- Credential format: [[SPEC-CRED-0001]], SD-JWT VC profile: [[SPEC-CRED-0002]]
- Schema catalogue: [[SPEC-SCHEMA-0001]], education: [[SPEC-SCHEMA-0002]], sectors: [[SPEC-SCHEMA-0003]]
- Packages: [`@tamga-network/sd-jwt`](/packages/sd-jwt), [`@tamga-network/mdoc`](/packages/mdoc), [`@tamga-network/schemas`](/packages/schemas)
