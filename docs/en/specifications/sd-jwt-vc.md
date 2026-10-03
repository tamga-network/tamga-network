---
document_id: SPEC-CRED-0002
title: "SD-JWT VC profile"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  Defines the bytes of a Tamga credential: how a disclosure is produced (salt, array structure, JSON serialisation rule,
  base64url), how the _sd array is filled and why it is sorted, the decoy digest policy, the placement of _sd_alg, cnf and
  x5c, the ~-separated combined format, the sd_hash of the KB-JWT, and the ten-step verification algorithm. The diploma
  example of SPEC-SCHEMA-0002 is worked through end to end with real bytes. The Tamga profile adds normative constraints:
  ES256 mandatory, _sd_alg sha-256, KB-JWT mandatory without exception, decoys forbidden.
translation_of: SPEC-CRED-0002
source_version: 1.0.0
---
**This specification defines Tamga's SD-JWT VC credential at byte level.** It is for developers who write their own issuing
or verifying code.

**When to read**

- First read the [Credential formats](/concepts/credential-formats) and [Privacy](/concepts/privacy) concept pages, and
  [[SPEC-CRED-0001]] for the format decisions.
- When you write your own SD-JWT producer or verifier without the `@tamga-network` packages.
- Next: how the credential is issued, [[SPEC-PROTO-0001]]; how it is presented, [[SPEC-PROTO-0002]].

**In brief.** An [[t:SD-JWT-VC]] consists of a JWT signed by the institution plus fields that can be revealed one by one.
Each field is hashed together with a random salt ([[t:salted-hash]]); the JWT carries only these hashes. When the person
wants to show a field, they attach that field's [[t:disclosure]]; the verifier recomputes the hash and compares it with the
one in the JWT. A short signature appended at the end of the presentation ([[t:KB-JWT]]) proves that the presenter holds the
key on the person's device.

---

# Scope

[[SPEC-CRED-0001]] **chose** the format; this document **writes** it. Every byte of a Tamga [[t:credential]] is defined
here.

**Standards basis:** SD-JWT — **RFC 9901**. SD-JWT VC — draft-ietf-oauth-sd-jwt-vc (the Type Metadata mechanism is covered
in [[SPEC-SCHEMA-0001]]).

Out of scope: the issuance protocol ([[SPEC-PROTO-0001]]), the presentation protocol ([[SPEC-PROTO-0002]]),
[[t:revocation]] ([[SPEC-CRED-0003]]).

---

# 1. Tamga profile — normative constraints

The standard leaves many options open. Tamga narrows them:

| Topic | Standard | **Tamga** | Rationale |
|---|---|---|---|
| Signature algorithm | Various | **ES256 (P-256)** | Universal in mobile secure elements and HSMs |
| `typ` | `dc+sd-jwt` | **`dc+sd-jwt`; `vc+sd-jwt` is rejected** | §5.1.1 |
| Serialisation | Free | **Fixed convention (when producing)** | §3.5 |
| `_sd_alg` | Various | **`sha-256`** | One hash, no implementation complexity |
| Salt length | ≥128 bits recommended | **128 bits (16 bytes)** | The standard's recommendation |
| Key binding | Optional | **Mandatory without exception** | [[SPEC-CRED-0001]] §3 |
| Decoy digest | Allowed | **Forbidden** | §4.4 |
| Issuer identity | `iss` / `x5c` / `kid` | **`x5c` mandatory** | [[SPEC-ID-0002]] |
| Nested selective disclosure | Allowed | **At most 2 levels** | [[RS-SCHEMA-0001]] §9 |
| Hiding array elements | Allowed | **Not used in the initial stage** | Complexity; no need |

---

# 2. Anatomy

An SD-JWT VC consists of three parts separated by a **tilde (`~`)**:

```
<Issuer-signed JWT>~<Disclosure 1>~<Disclosure 2>~...~<KB-JWT>
```

Rules:

- The separator is `~` (U+007E).
- At issuance the last element is **empty** — the string ends with `~` (there is no KB-JWT yet).
- At presentation the last element is the KB-JWT.
- The order of disclosures is **meaningless**, and the verifier must not rely on it.

```
Issued (kept in the wallet):
  JWT~D1~D2~D3~D4~D5~D6~D7~

Presented (sent to the verifier — only 3 disclosures selected):
  JWT~D2~D5~D6~KB-JWT
```

**Key observation:** the wallet **removes** the disclosures it does not present from the string. The JWT does not change and
the signature stays valid. Hiding is not adding something, it is **removing**.

---

# 3. Producing a disclosure

## 3.1 Structure

For every claim that can be revealed with [[t:selective-disclosure]], a three-element JSON array:

```json
["<salt>", "<claim name>", <claim value>]
```

The array is serialised as JSON, converted to UTF-8 and encoded as **base64url** (without padding). The result is the
disclosure string.

## 3.2 Salt

- **128 bits (16 bytes)** from a cryptographically secure generator.
- A **new** salt for every disclosure. The same salt cannot be used twice.
- It appears in the array as base64url (without padding) → 22 characters.

**Why a salt:** without a salt, the hash of the array `["given_name","Ayşe"]` would be constant. A
[[t:verifier|verifier]] seeing a hidden digest could guess with a dictionary attack that "this field is `given_name` and its
value is `Ayşe`". For low-entropy fields such as `birth_date` this attack costs next to nothing.

## 3.3 The serialisation rule — the most critical implementation detail

**The hash of a disclosure is the hash of the disclosure *string* — not of the array re-serialised.**

```
digest = base64url( SHA-256( ASCII bytes of <disclosure string> ) )
```

That is:

1. The [[t:issuer|issuer]] serialises the array to JSON → **these bytes are now fixed**
2. It encodes them with base64url → the disclosure string
3. digest = SHA-256(the **ASCII bytes** of the disclosure string)

The verifier goes the other way: it takes the disclosure string, **hashes it first**, then decodes it. It never decodes,
re-serialises and then hashes.

**Why this matters so much:** JSON serialisation is not deterministic. Whitespace, Unicode escaping (`ç` vs `ç`), key
order — each produces different bytes and a different hash. An implementation that re-serialises cannot even verify the
credentials it produced itself.

This is **the most common mistake** in SD-JWT implementations.

## 3.4 Example — with real values

Let us hide the field `given_name: "Ayşe"`. **The values below are real computation output**, not made up; they were
produced with the Tamga serialisation convention (§3.5).

```
1. Salt (16 bytes):
   hex        : 3af29c417b0ed5882691ff4ca307be52
   base64url  : OvKcQXsO1Ygmkf9Mowe-Ug          (22 characters)

2. JSON array (these bytes are now fixed):
   ["OvKcQXsO1Ygmkf9Mowe-Ug", "given_name", "Ayşe"]

3. UTF-8 → base64url = DISCLOSURE:
   WyJPdktjUVhzTzFZZ21rZjlNb3dlLVVnIiwgImdpdmVuX25hbWUiLCAiQXlcdTAxNWZlIl0

4. digest = base64url(SHA-256(ASCII bytes of the string in step 3)):
   nM_EESmLJt3b0fzNu1paGyiAfSLs4Npf2yEjUn0upSo   (43 characters)
```

Two more examples:

| Claim | Disclosure | Digest |
|---|---|---|
| `family_name: "Yılmaz"` | `WyJDWmNVejJVZEJpdzM5b2ZYSC1ZRmhRIiwgImZhbWlseV9uYW1lIiwgIllcdTAxMzFsbWF6Il0` | `z1_SoX1L6xCo9GKQf0f5lEdLisaiHfvejfETWcUCLNs` |
| `grade: "3.42"` | `WyIweEtpU3JVZ1RULWtYNVNsTUNnS09BIiwgImdyYWRlIiwgIjMuNDIiXQ` | `rdPfUM0_1bDXDRhvpkze7Im098NzDSfvn9tG2CMDTmM` |

The digest goes into the `_sd` array. The disclosure travels **outside** the JWT, separated by `~`.

## 3.5 The serialisation convention and the re-serialisation trap

### Demonstrating the trap

Let us decode the disclosure above and **re-serialise** it:

```
Decoded array:
  ["OvKcQXsO1Ygmkf9Mowe-Ug", "given_name", "Ayşe"]      ← same data

Different serialisation (no spaces, no Unicode escaping):
  ["OvKcQXsO1Ygmkf9Mowe-Ug","given_name","Ayşe"]

Digest computed from this string:
  c94D71JDfX8hzanT-ZpRWBn5oNX_RkStfSfkvTmY_kU

Original digest:
  nM_EESmLJt3b0fzNu1paGyiAfSLs4Npf2yEjUn0upSo

NO MATCH.
```

The data is **exactly the same.** The only things that changed are two spaces and the escaping of the character `ş`. The
digest is completely different.

That is why the verifier **hashes the disclosure first and decodes it afterwards** (§8, Ş5a). An implementation that decodes
and re-serialises cannot even verify the credential it produced itself — and that is exactly the symptom.

### Tamga issuer convention (normative)

The verification side works independently of serialisation (the string is hashed as it is). But **on the issuer side** the
convention is fixed; otherwise different Tamga issuer implementations could not produce comparable test vectors:

| Rule | Value |
|---|---|
| Unicode | `ensure_ascii` — non-ASCII characters are escaped as `\uXXXX` |
| Element separator | `", "` (comma + space) |
| Array | Exactly 3 elements, in order salt, name, value |

This convention is **for producing only.** The verifier can — and must — verify disclosures that do not follow the
convention; credentials from external ecosystems may use a different one.

---

# 4. The `_sd` array

## 4.1 Placement

The digests of hidden claims are collected in the `_sd` array inside the JSON object where the claim would sit:

```json
{
  "iss": "https://issuer.bilgi.edu.tr",
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "_sd_alg": "sha-256",
  "_sd": [
    "Kx8vNmQ2pTr7LhWc4YsAeJ1BdFgHiZoNuVxCyRmEqPk",
    "9dLpXfR3wQmKzT2vBnHsAe6YuCiJoNlPqEgWrMxZkFv",
    "..."
  ],
  "eqf_level": 6
}
```

Claims that are not hidden (such as `eqf_level`) sit directly in the payload.

## 4.2 Sorting — normative

The `_sd` array is **always sorted** (ascending byte order).

**Why:** unsorted, the order in the array would reveal the original claim order. A verifier that sees the hidden digests line
up with the field order of the schema could work out which fields were hidden.

Sorting closes this side channel.

## 4.3 `_sd_alg`

At the **root level** of the payload, once:

```json
"_sd_alg": "sha-256"
```

In Tamga it is always `sha-256`. If the value is missing, `sha-256` is assumed by default, but Tamga issuers **write it
explicitly.**

## 4.4 Decoy digest — forbidden in Tamga

The standard allows adding fake ("decoy") digests to the `_sd` array that correspond to no disclosure. The aim is to blur the
**number** of hidden fields.

**Forbidden in Tamga.** Reasons:

1. **The schema already reveals the number.** `vct` is in the clear; the verifier resolves the schema and knows exactly how
   many fields there are. A decoy tries to hide a known number — it gives no protection.
2. **Unverifiable asymmetry.** The number of decoys is up to the issuer; if two issuers use different numbers of decoys,
   that difference is itself a fingerprint.
3. **Size.** Each decoy is 43 characters; it needlessly enlarges the QR code.

It is true that the number of hidden fields is a side channel ([[SPEC-SCHEMA-0002]] security notes); the fix is not decoys
but the wallet presenting a **consistent disclosure set** to the same verifier.

---

# 5. Issuer-signed JWT

## 5.1 Header

```json
{
  "alg": "ES256",
  "typ": "dc+sd-jwt",
  "x5c": ["MIIB<issuer certificate>", "MIIC<intermediate CA>"]
}
```

| Field | Tamga rule |
|---|---|
| `alg` | `ES256` — any other value is rejected |
| `typ` | **`dc+sd-jwt`** — §5.1.1 |
| `x5c` | **Mandatory.** Leaf certificate first, the root is **not included** |

The root certificate is not placed in `x5c`; the chain is anchored to the anchor in `RootCARegistry` ([[SPEC-ID-0002]],
[[SPEC-BC-0001]]).

### 5.1.1 The `typ` value and `vc+sd-jwt` compatibility

The standard requires the issuer to include the `typ` header parameter with the value **`dc+sd-jwt`**. The media type is
`application/dc+sd-jwt`; the `dc` subtype means "digital credential".

**History — worth knowing.** From its start in July 2023 until November 2024 the draft used **`vc+sd-jwt`** as the `typ`
value. It was changed to `dc+sd-jwt` to avoid a clash with the `vc` media type name registered by the W3C Verifiable
Credentials Data Model draft.

After this change a transition note was added to the drafts: verifiers and [[t:holder|holders]] were advised to accept
**both values** for a reasonable transition period. That note was **removed** in later draft revisions — so the transition
period is considered over by the standard.

**Tamga decision:**

| Direction | Rule |
|---|---|
| **Issuance** | Only `dc+sd-jwt`. `vc+sd-jwt` is not produced. |
| **Verification — Tamga issuers** | Only `dc+sd-jwt` is accepted. `vc+sd-jwt` is **rejected.** |
| **Verification — external ecosystem** | Configurable compatibility flag, **off by default**; when on, it is accepted but a warning is written to the audit log. |

Rationale: Tamga carries no legacy — every issuer is new. An implementation producing `vc+sd-jwt` is two years behind,
which signals other incompatibilities too. On the other hand, rejecting a credential from an external ecosystem merely
because of `typ` could break interoperability needlessly; that is why the flag exists but is off.

`@tamga-network/verifier` defines this flag as `acceptLegacyVcSdJwtTyp: false` ([[ARCH-0005]]).

## 5.2 Body — fields that are not hidden

Under [[SPEC-SCHEMA-0001]] §4, fields with `sd: "never"` are always in the clear:

| Claim | Why in the clear |
|---|---|
| `iss` | Who signed |
| `vct`, `vct#integrity` | Schema resolution ([[SPEC-SCHEMA-0001]] §7) |
| `iat` | Freshness |
| `cnf` | Key binding (§6) |
| `status` | Revocation check ([[SPEC-CRED-0003]]) |
| `_sd_alg`, `_sd` | The mechanism itself |
| `exp` | If present |
| `category` | If present — signal of the issuer **class** ([[ADR-0010]] K5): `urn:tamga:eaa:pub` (PUB) / `urn:tamga:eaa:qualified` (QUALIFIED); I1–I2 issuers do not set it; the verifier cross-checks it against the registration (C4). Never the holder level ([[SPEC-PROTO-0001]]/PR7) |

## 5.3 Placement of `cnf`

```json
"cnf": {
  "jwk": {
    "kty": "EC",
    "crv": "P-256",
    "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
    "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
  }
}
```

The **public** part of the wallet's device key. The private key never leaves the secure element ([[SPEC-CRED-0001]] §3).

`cnf` **cannot be hidden** (`sd: never`) — it is needed to verify key binding.

---

# 6. KB-JWT (Key Binding JWT)

## 6.1 Structure

Produced by the wallet at presentation time and appended to the end of the combined string.

Header:

```json
{
  "alg": "ES256",
  "typ": "kb+jwt"
}
```

Body:

```json
{
  "nonce": "1234567890abcdef",
  "aud": "https://verifier.example.com",
  "iat": 1789003600,
  "sd_hash": "Vx2mNqL8pRt4KzYwBhSaEc7JuFiGoNdXvCyTrMkZqPw"
}
```

| Claim | Meaning |
|---|---|
| `nonce` | Single-use value given by the verifier — replay protection |
| `aud` | Target verifier — cannot be re-presented to another verifier |
| `iat` | Presentation time |
| `sd_hash` | §6.2 — integrity of the presented set |

The KB-JWT is signed with the **private key** matching the key in `cnf`.

## 6.2 Computing `sd_hash`

```
sd_hash = base64url( SHA-256( ASCII bytes of
    "<JWT>~<selected D1>~<selected D2>~...~"
))
```

**Points to watch:**

- The string that goes into the hash is the combined representation **without the KB-JWT**.
- The **`~` after the last disclosure is included.**
- Only the **presented** disclosures are included; not the ones left in the wallet.

## 6.3 Why it is needed

Without `sd_hash`, a party in the middle could **remove** some of the presented disclosures — the JWT signature and the
KB-JWT signature would still be valid.

Example attack: Ayşe presents her diploma with `is_graduate` + `grade`. The party in the middle deletes the `grade`
disclosure. Without `sd_hash` the verifier cannot notice and takes an incomplete presentation for a complete one. `sd_hash`
binds the presented set to **exactly** what it is.

## 6.4 Mandatory without exception in Tamga

A presentation without a KB-JWT is **rejected.** The standard leaves it optional; Tamga does not — this is the
[[t:holder-binding]] rationale of [[SPEC-CRED-0001]] §3.

A reminder of the `cnf` scope limit ([[SPEC-CRED-0001]] §3): the KB-JWT proves **control of the key**, not **the person's
identity**.

---

# 7. End-to-end example

The diploma of [[SPEC-SCHEMA-0002]] §3.6, at wire-format level.

## 7.1 Issuance — what the issuer produces

The schema's `claims` block ([[SPEC-SCHEMA-0002]] §5.2) gives the `sd` policy:

| Claim | `sd` | Result |
|---|---|---|
| `birth_date`, `grade`, `thesis_title` | `always` | **Always hidden** |
| `family_name`, `given_name`, `qualification_title`, `eqf_level`, `isced_f_code`, `awarding_date`, `awarding_body_name`, `awarding_body_id`, `awarding_body_country`, `nqf_level`, `mode_of_study`, `credit_points`, `grading_scheme`, `is_graduate`, `graduated_before` | `allowed` | Hidden by the issuer |
| `iss`, `vct`, `iat`, `cnf`, `status`, `_sd_alg` | `never` | In the clear |

A Tamga issuer hides **all** `allowed` fields. Rationale: hiding costs nothing; not hiding cannot be undone.

Result: 18 disclosures.

```
eyJhbGciOiJFUzI1NiIsInR5cCI6ImRjK3NkLWp3dCIsIng1YyI6WyJNSUlCLi4uIl19
.eyJpc3MiOiJodHRwczovL2lzc3Vlci5iaWxnaS5lZHUudHIiLCJ2Y3QiOiJodHRwczo...
.MEUCIQDx7... 
~WyJPdktjUVhzTzFZZ21rZnhNb3dlLVVnIiwgImZhbWlseV9uYW1lIiwgIll..."
~WyJoTjJ4UjhwTHc0S3ZUeTBhIiwgImdpdmVuX25hbWUiLCAiQXlcdTAxNWZlIl0
~WyJtUTdmVjNzWnAxTndFeThiIiwgImJpcnRoX2RhdGUiLCAiMjAwMy0wNC0xNyJd
~... (15 more disclosures) ...
~
```

The empty `~` at the end — no KB-JWT.

## 7.2 Presentation — employer scenario

Under [[SPEC-SCHEMA-0002]] §3.7 these fields are revealed: `is_graduate`, `qualification_title`, `eqf_level`,
`isced_f_code`, `awarding_body_name`, `awarding_date`, `family_name`, `given_name`.

The wallet:

1. Selects 8 of the 18 disclosures and **removes** the other 10 from the string.
2. Computes `sd_hash` over the remaining string (§6.2).
3. Signs the KB-JWT with the device key.

```
<same JWT — unchanged>~D_family~D_given~D_qual~D_eqf~D_isced~D_body~D_date~D_grad~<KB-JWT>
```

**What the employer cannot see:** `grade` (3.42), `thesis_title`, `birth_date`, `credit_points`, `mode_of_study`,
`grading_scheme`, `nqf_level`, `graduated_before`, `awarding_body_id`, `awarding_body_country`.

It sees their **digests** in the `_sd` array but cannot derive a value from a digest (thanks to the salt, §3.2).

---

# 8. Verification algorithm

Normative. This is the **format** layer of verification; the schema layer is in [[SPEC-SCHEMA-0001]] §7 and the revocation
layer in [[SPEC-CRED-0003]] §7. The full order is assembled in [[SPEC-API-0001]].

```
Ş1.  Split the string on ~.
     First element = JWT. Last element = KB-JWT (if empty → REJECT, §6.4).
     The ones in between = disclosures.

Ş2.  Decode the JWT header.
     alg != "ES256" → REJECT.
     typ != "dc+sd-jwt" → REJECT.
       ("vc+sd-jwt" accepted only if the compatibility flag is on and the credential is
        from an external ecosystem; warning in the audit log — §5.1.1)
     No x5c → REJECT.

Ş3.  Verify the x5c chain (SPEC-ID-0002).
     Root not RootCARegistry.isChainAcceptable → REJECT  (RETIRED accepted, REVOKED rejected)
     Leaf certificate revoked in CRL/OCSP → REJECT
     Verify the JWT signature with the leaf certificate key → if invalid, REJECT.
     issuerId = keccak256(stateCode, SHA-256(x5c[0] DER))   ← NOT from the iss claim
     iss claim inconsistent with the registered issuer metadata → REJECT

Ş3b. No cnf claim → REJECT (KB-JWT mandatory without exception; an SD-JWT VC without cnf is invalid in Tamga).

Ş4.  Read _sd_alg. Not "sha-256" → REJECT.

Ş5.  For each disclosure:
       a) digest = base64url(SHA-256(ASCII bytes of the disclosure string))
          ← hash FIRST, decode AFTERWARDS (§3.3)
       b) Is the digest in the _sd array? If not → REJECT (unmatched disclosure)
       c) base64url-decode → JSON array
       d) Array does not have 3 elements → REJECT
       e) Salt < 128 bits → REJECT
       f) Claim name already present in the clear in the payload → REJECT (collision)

Ş6.  The same digest claimed by two disclosures → REJECT.

Ş7.  Place the decoded claims into the payload. Remove _sd and _sd_alg.

Ş8.  KB-JWT:
       a) typ == "kb+jwt", alg == "ES256"
       b) Verify the signature with the key in cnf → if invalid, REJECT
       c) aud == my own identifier → otherwise REJECT
       d) nonce == the one I issued → otherwise REJECT
       e) iat within the freshness window: |now - iat| ≤ 300 s → otherwise REJECT
       f) Compute sd_hash yourself and compare with the one in the KB-JWT → mismatch → REJECT

Ş9.  If exp is present, has it passed → if so, REJECT.

Ş10. Result: the verified claim set.
     Continue: schema (SPEC-SCHEMA-0001 §7), revocation (SPEC-CRED-0003 §7).
```

## 8.1 Why Ş5(b) is critical

Accepting an unmatched disclosure would let an attacker **add fields** to the credential. If the digest is not in `_sd`,
that disclosure was not signed by the issuer.

## 8.2 Ş5(f) — collision

A disclosure carrying a claim that already sits in the clear in the payload is rejected. Otherwise critical fields such as
`iss` or `vct` could be overwritten.

---

# 9. Invariants

| # | Invariant |
|---|---|
| **C1** | `alg` is always `ES256`. |
| **C2** | `_sd_alg` is always `sha-256` and written explicitly. |
| **C3** | Salt ≥ 128 bits, unique for every disclosure. |
| **C4** | The digest is the hash of the disclosure **string**; there is no re-serialisation. |
| **C5** | The `_sd` array is sorted. |
| **C6** | No decoy digests are used. |
| **C7** | `x5c` mandatory; the root certificate is not included. |
| **C8** | KB-JWT mandatory without exception. |
| **C9** | `sd_hash` is computed over the presented set, including the trailing `~`. |
| **C10** | An unmatched disclosure is rejected. |
| **C11** | Nested selective disclosure at most 2 levels. |
| **C12** | Hiding = removing from the string; the JWT is never re-signed. |
| **C13** | `typ` is always `dc+sd-jwt`; `vc+sd-jwt` is not accepted from Tamga issuers. |
| **C14** | The verifier does not decode and re-serialise a disclosure (§3.5). |
| **C15** | `issuerId` is derived from the leaf certificate fingerprint; `iss` is only a consistency check. |
| **C16** | An SD-JWT VC without a `cnf` claim is rejected. |
| **C17** | The KB-JWT `iat` window is ±300 seconds. |
| **C18** | The `category` claim appears only for issuers whose registered class is PUB/QUALIFIED, and only with the values `urn:tamga:eaa:pub|qualified`; EU URNs (`urn:etsi:esi:eaa:eu:*`) are not used; holder assurance is carried in no claim ([[ADR-0010]] K5). |

---

# Security notes

**Re-serialisation (C4).** The most common implementation mistake. If a library decodes a disclosure, re-serialises it and
then hashes it, the hash does not match because of Unicode escaping or whitespace. Symptom: "I cannot verify the credential
I produced myself."

**Salt reuse.** If the same salt is used for the same claim in two credentials, the two digests are identical and the
credentials become linkable. The generator must provide a new salt every time.

**`nonce` must be single-use.** The verifier must store the [[t:nonce]] and not accept it again; otherwise a recorded
presentation can be replayed. `aud` is the second line of defence.

**Disclosure-count side channel.** Covered in §4.4; the fix is a consistent disclosure set, not decoys.

---

# Open topics

1. ~~Confirming the `typ` value~~ — **CLOSED** (2026-09-09). `dc+sd-jwt` confirmed; the transition period and the
   `vc+sd-jwt` decision are written in §5.1.1.
2. Selective disclosure of array elements (hiding a single line in a transcript) is not used in the initial stage. It will be needed
   when the transcript schema is written → scope extension of [[SPEC-SCHEMA-0002]].
3. ~~Scope of the consistent disclosure set~~ — **CLOSED** ([[SPEC-WALLET-0001]]/WL6): **per verifier + `vct`**, not per
   session. The threat is comparing two presentations made to the same verifier.
4. ~~Same or different `cnf` in batch issuance~~ — **CLOSED** (2026-09-09, [[SPEC-PROTO-0001]] §8.2, PR6). Each copy is
   bound to a **different device key**; with the same `cnf` the copies could be linked and the whole point of the batch
   would be lost. The salts naturally differ as well (C3).

---

# Related documents

[[SPEC-CRED-0001]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-ID-0002]] ·
[[SPEC-BC-0001]] · [[ADR-0006]] · [[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-API-0001]]

---

# Status

**In force** — version 1.0.0 (2026-10-02).
