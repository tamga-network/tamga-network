---
document_id: GUIDE-0014
title: "Onboarding tool: for the IT team"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  Joining with the tamga-onboard tool, step by step, for the IT team of an issuing or verifying institution: the sandbox trial,
  the application file (init), checking it against the registration rules (validate), keys and certificate signing requests
  (keys; HSM and cloud-sync warning), sending the application, placing the certificates, the setup (.well-known, lookup endpoint)
  and its check (check), the entry in the trust list (check --listing), the Institution Console invitation and the first
  credential; connecting the tool to an AI assistant over MCP and its security limits; troubleshooting.
translation_of: GUIDE-0014
source_version: 1.0.0
---

# Onboarding tool: for the IT team

This guide is for the IT team of an institution that will join Tamga Network as an **issuer** (a university, professional body
or public body) or as a **verifier** (a hotel, employer or website). You do all the technical work on your side with the
`tamga-onboard` command: the application file, the keys, the certificate signing requests, the setup check and, after joining,
how your institution appears in the trust list.

**When to read it:**
- After your institution has decided to join, while preparing the application.
- First: [[GUIDE-0007]] (joining as an issuer: the process, checklist and roles) or [[GUIDE-0008]] (verifier registration). This
  guide is the IT side of those processes.
- Next: [[GUIDE-0003]] (issuing credentials technically) or [[GUIDE-0002]] (verifying on your server).

## What the tool does and does not do

| It does | It does not |
|---|---|
| Writes the application files and checks them with the registration rules ([[ADR-0024]]) | Write to the network or the [[t:trust-list]]; the registrar makes the entry |
| Generates your two signing keys **on your computer** and writes the certificate signing requests (CSRs) | Send a private key anywhere; its output is local files only |
| Checks your domain, DNS confirmation, https addresses, metadata and lookup endpoint | Ask for or write personal data (not even the name of a signatory) |
| After joining, verifies your entry in the signed list against root pins embedded in the package | Execute anything it reads from the network |

The same operations are offered as a local **MCP server**, so your institution's own AI assistant can run the steps for you
(see "Using it over MCP").

If you will run a node of the shared ledger as a state or operator, the same tool's `tamga-onboard node init|declare|check`
commands and MCP tools are covered in [[GUIDE-0015]] (node operator handbook).

## Installing

You need Node.js 22 or later. No `openssl` needed.

```sh
npm install -g @tamga-network/onboard     # or: npx -p @tamga-network/onboard tamga-onboard --help
```

The package is published on npm as the 0.8.3 test release (the stable 1.0.0 comes when everything is
ready — in test releases the commands and options may change). The first release was published by hand without provenance;
later releases come from GitHub Actions and carry provenance.

::: tip Running from source (optional)
In a clone of the repository the tool also runs without a build step: `npm install`, then
`npx tsx packages/onboard/src/cli.ts` in place of `tamga-onboard`.
:::

Exit codes: `0` all good · `1` a check or validation failed · `2` usage error. `--json` prints the report as JSON.

## Step by step

| # | Step | Command | Who |
|---|---|---|---|
| 0 | Try the sandbox | `tamga-onboard sandbox` | IT |
| 1 | Application file | `tamga-onboard init` | IT (with input from legal and student affairs) |
| 2 | Check | `tamga-onboard validate <folder>` | IT |
| 3 | Keys and CSRs | `tamga-onboard keys <folder>` or `keys --inspect` | IT / security |
| 4 | Setup check and report | `tamga-onboard check <folder> --report report.json` | IT |
| 5 | Send the application | email | the institution's authorised person |
| 6 | Certificates arrive | place the files in `keys/` | IT |
| 7 | Setup | `.well-known`, lookup endpoint → `tamga-onboard check` | IT |
| 8 | Entry in the list | `tamga-onboard check <folder> --listing` | IT |
| 9 | Institution Console and first credential | invitation link + passkey | the institution's administrator |

### 0. Try the sandbox

```sh
tamga-onboard sandbox
```

The command prints the address of the sandbox's "Try your institution" page (`https://sandbox.tamga.network/institutions/new`)
and the steps. You open the test institution in your browser: a made-up name (real institution names and official words such as
"University" or "Ministry" are refused), a one-time Console invitation, made-up records only, issuing, verifying and revoking. The
sandbox needs no application file, key or CSR; everything is deleted every night ([[GUIDE-0013]]). With the test institution's
short name (`t-…`) you can also try the list check:

```sh
tamga-onboard check --listing-only --env sandbox --slug t-xxxxxxxxxx
```

### 1. Application file: `init`

```sh
tamga-onboard init                         # questions → tamga-onboarding/<short name>/
tamga-onboard init --from answers.json     # the same answers from a file
```

The tool asks for the information in the [[GUIDE-0007]] §2 checklist: role, permanent short name (`slug`), legal name,
institution identifier (VKN or MERSİS), postal address, support address and institutional email, domain, credential types,
service model, lookup endpoint address, the programmes' ISCED-F codes. An answers file:

```json
{
  "role": "issuer",
  "slug": "example-college",
  "legal_name": "Example College",
  "identifier": { "scheme": "TR-VKN", "value": "TR1234567890" },
  "postal_address": { "street_address": "Example Street 1", "locality": "Istanbul", "country": "TR" },
  "contact": { "support_uri": "https://example.edu.tr/support", "email": "info@example.edu.tr" },
  "domain": "example.edu.tr",
  "vcts": ["urn:tamga:edu:StudentCredential:1", "urn:tamga:edu:DiplomaCredential:1"],
  "hosting": "hosted",
  "identity_matching": { "privacy_policy_uri": "https://example.edu.tr/privacy/tamga" },
  "lookup_url": "https://sis.example.edu.tr/tamga/lookup",
  "isced_f_codes": ["0613"]
}
```

| Field | Note |
|---|---|
| `hosting: "hosted"` | Tamga's hosted issuing service (`issuer.tamga.network/<slug>`). The tool also writes the identity-matching application (`<slug>.rp.json`); the service holds that entry's key and the registrar issues its certificate |
| `hosting: "own"` | Your own issuing service: needs `issuer_url` and `status_list_base` (both https) |
| `role: "verifier"` | A verifier: `dns_name`, `service_description`, `is_public_sector_body` and, for each use, the purpose, credential type, **fewest fields** and privacy policy (`scopes`) |
| `contact.email` | An institutional role address; do not use a personal address |

The output folder is `tamga-onboarding/<slug>/`: `onboarding.json` (the tool's profile) and the application files
(`<slug>.issuer.json` and, where needed, `<slug>.rp.json`). Unknown fields are rejected, so information such as a person's name
cannot slip into a file. The `slug` is a public, permanent name; it is settled with the registrar, and a name once used is never
given out again.

### 2. Check: `validate`

```sh
tamga-onboard validate tamga-onboarding/example-college
```

Checks an application, an answers file or the whole folder with the rules the registrar uses: the mandatory registration data
([[ADR-0024]]), the identifier's format and checksum, https addresses, four-digit ISCED-F codes. All gaps are listed at once.
For the `PUB` class (public body credential) the tool gives a warning: that class is discussed with the registrar separately.

### 3. Keys and certificate signing requests: `keys`

An issuer has two keys (credentials and the [[t:status-list|status list]]), a verifier one (the [[t:access-certificate|access
certificate]]); all are P-256 / ES256.

| Key name | What it signs |
|---|---|
| `issuer-<slug>` | the credentials you issue |
| `issuer-<slug>-status` | your status list |
| `rp-<name>` | the requests you send as a verifier |

**Recommended: an HSM or a remote signing service.** On the live network the keys are preferably generated in your
institution's HSM or at a trust service provider you contract with. If you use the hosted service this is required: the service
asks for each signature over the remote signing interface (Cloud Signature Consortium API v2) and sends only the digest to be
signed; the institution key is not kept as a file on the service's server ([[ADR-0057]]). Check the CSR your HSM produced
against your application:

```sh
tamga-onboard keys --inspect issuer.csr.pem tamga-onboarding/example-college
```

The check shows that the CSR subject carries your legal name, country and institution identifier (`organizationIdentifier`:
`VATTR-<VKN>` or `NTRTR-<MERSİS>`) and that the signature is valid ([[ADR-0050]]).

**Software keys (your own service, or a trial).** The tool can generate the keys on this computer:

```sh
read -rs TAMGA_KEY_PASS && export TAMGA_KEY_PASS   # at least 12 characters; not shown and not kept in shell history
tamga-onboard keys tamga-onboarding/example-college --passphrase-env TAMGA_KEY_PASS
```

- Output: `keys/<name>.key.pem` (owner-only permissions, encrypted with the passphrase) and `keys/<name>.csr.pem`. Existing files
  are never overwritten; if even one exists, nothing is written.
- The passphrase is never typed on the command line; only the **name** of an environment variable is given. On Windows a key
  without a passphrase is generated only with an explicit `--no-passphrase`.
- Back up a software key (encrypted, offline) and keep it where only the people who need it can reach it. If you lose it, the
  certificate is renewed; if you think it has been compromised, tell the registrar at once.

::: danger Cloud-synced folder
The tool refuses to write a private key into a folder synced with OneDrive, Dropbox, Google Drive or iCloud: the key would be
copied to a server outside your institution. On Windows, "Documents" and "Desktop" are often synced to OneDrive; move the
onboarding folder somewhere that is not synced (for example `C:\tamga-onboarding`). Use `--allow-synced` only deliberately and
after turning syncing off for that folder.
:::

### 4. Setup check and report: `check`

```sh
tamga-onboard check tamga-onboarding/example-college --report report.json
```

Checks the application files, that each key matches its CSR, that your domain resolves, that the addresses in the entry (support,
privacy policy) open and, if there is one, your lookup endpoint. The report is a pass/fail table; every failed row comes with its
fix. At this stage some rows are expected to fail or be skipped: DNS confirmation (no value yet), certificates (none yet),
metadata (service not set up yet).

The tool reads only over https, follows redirects one hop at a time and does not connect to local or private network addresses
(`--allow-http`, `--allow-private` for local tests). It probes the lookup endpoint only with requests that **must be refused**;
no record, real or invented, is asked for.

### 5. Sending the application

Your institution's authorised person sends the application from an institutional email address to **partners@tamga.network**.
Attachments:

| Send | Never send |
|---|---|
| `<slug>.issuer.json` and, if any, `<slug>.rp.json` | `keys/*.key.pem` (private keys) |
| `keys/*.csr.pem` (or the CSRs your HSM produced) | passphrases, HSM access details, the remote signing service's secret |
| `report.json` | personal data, student records |

The documents required at your level (proof of legal personality, signed participation agreement, data protection annexes) are
listed in [[GUIDE-0007]] §2. The registrar reports all gaps at once. For domain ownership it gives you a one-time value; add it as
a TXT record in your domain's DNS and check:

```sh
tamga-onboard check tamga-onboarding/example-college --dns-txt <value given>
```

If you use the hosted service, you share your remote signing service's address and the client identifier you issued for the
service with the registrar over a separate, secure channel; the secret is never sent by email.

### 6. Certificates arrive

The registrar verifies your CSRs' signatures and issues your certificates (2 years, at most 3). Put each certificate into the
onboarding folder as `keys/<name>.cert.pem`, named after its key, and check again:

```sh
tamga-onboard check tamga-onboarding/example-college
```

The tool checks that the certificate belongs to your private key, that its subject carries your institution identifier, the
validity dates and, in an access certificate, your domain. A mismatch may mean the certificate was issued from the wrong CSR:
talk to the registrar.

### 7. Setup: metadata and the lookup endpoint

**Hosted service.** The service issues on your behalf; the only endpoint you set up is your **lookup endpoint**. Tamga keeps no
register of people; at the moment of issuance it asks your system with a signed request, takes the single record and does not
keep it ([[ADR-0020]], contract: [Institution lookup endpoint](/api/institution-source)). The quickest start is the open-source
example endpoint (`examples/05-institution-source` in the repository, [[GUIDE-0004]] §5). The endpoint:
- must be reachable from outside over https (the hosted service connects to it);
- must refuse an unsigned or invalid request with `400`/`401`, never with a `2xx`;
- returns only the fields the credential type needs; a national identity number is never returned;
- carries a four-digit ISCED-F code in every record; without one no credential is issued.

**Your own service.** Your issuing service publishes its [[t:OpenID4VCI]] metadata with the RFC 8414 address rule: `.well-known/<type>`
goes between the host and the path.

| Metadata | Address (example `issuer_url` = `https://example.edu.tr/issuer`) |
|---|---|
| Credential issuer | `https://example.edu.tr/.well-known/openid-credential-issuer/issuer` |
| Authorisation server | `https://example.edu.tr/.well-known/oauth-authorization-server/issuer` |

Signed metadata is signed with your credential key and carries the certificate from the registrar in `x5c`. The status list is
published under `status_list_base`. Steps: [[GUIDE-0003]], [[SPEC-PROTO-0001]].

After setting up, run `tamga-onboard check` again; the metadata (`M1`–`M3`) and lookup endpoint (`Q1`) rows should pass.

### 8. Entry in the list: `check --listing`

Once the registrar has made the entry and re-signed the list, the change is live at `trust.tamga.network` within **24 hours**.
Check:

```sh
tamga-onboard check tamga-onboarding/example-college --listing
```

The tool downloads the signed list, verifies it against the root pins embedded in the package and checks your entry: are you in
the list and `ACTIVE`, is your registration data complete, your credential type authorisations, the parent certificate
authority, the publication and anchoring of your status list, your [[t:registration-certificate|registration certificates]]
(signatures against the registrar keys in the list), your identity-matching or verifier entry, your service metadata if any, and
that the certificate chain of your **signed metadata leads to the root in the list**.

- If a pin changes, the package is updated. In between, `--pin <hex>` takes a value you verified **out of band** at
  `tamga.network/trust-anchor`; the report then shows a warning row.
- It also works without an onboarding folder: `tamga-onboard check --listing-only --env production --slug <slug>`.
- In a new institution's first minutes the status list row may warn: until the list is published and anchored for the first
  time (one publication interval), this is expected.

### 9. Institution Console and the first credential

After registration the registrar sends your institution's first administrator a one-time invitation link (valid for 72 hours).
The administrator opens it and creates a [[t:passkey]] on their device; there is no password. From the Console they then invite
other staff and, if needed, create API keys ([[ADR-0016]]).

Issue the first credential to one of your own staff: Institution Console → **Issue** → the person takes it into their wallet →
presents it at `verify.tamga.network` → revoke it from the Console and see it rejected after the next publication. Details:
[[GUIDE-0007]] §7–§8. Until the status list is published for the first time, the first credentials may get "cannot verify right
now" (`INDETERMINATE`); try again after a few minutes.

For a verifier the counterpart of this step is the integration: attach your registration certificate to every request
([[GUIDE-0002]] step 4) and try it first with the sandbox verifier, then on the live network with your own staff.

## Using it over MCP

The same operations are offered as a local MCP server (stdio). Connect it to an MCP-capable AI assistant your institution uses;
the assistant runs the steps with your approval. After the first publication:

```json
{ "mcpServers": { "tamga-onboard": { "command": "npx", "args": ["-y", "-p", "@tamga-network/onboard", "tamga-onboard", "mcp", "--root", "C:\\tamga-onboarding"] } } }
```

From source (in a clone of the repository): `"command": "npx", "args": ["tsx", "<repo>/packages/onboard/src/cli.ts", "mcp", "--root", "<folder>"]`.

| Tool | Command equivalent |
|---|---|
| `create_application` | `init --from` |
| `validate_application` | `validate` |
| `generate_keys_and_csr` | `keys` |
| `check_installation` | `check` |
| `check_listing` | `check --listing` / `--listing-only` |
| `sandbox_info` | `sandbox` |

**Security limits** (enforced by the server itself):
- File access only inside the root folder (`--root`, default the working directory), also after symbolic links and junctions are
  resolved.
- No response contains private key content; only the file path and the public key digest are returned.
- A passphrase is given only as the name of an environment variable starting with `TAMGA_`; the passphrase itself is never
  typed to the assistant.
- Root pins cannot be overridden; local network addresses are never read; request addresses outside the institution's domain
  are flagged.
- Text read from the network is marked in the result as "untrusted data"; the assistant must not treat it as instructions.

Even so, do not give your assistant: a private key file, HSM or remote signing service access details, personal data. Your
institution's rules on AI use and its data processing agreements apply to this tool as well.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `keys`: "cloud-synced folder" | the folder is synced with OneDrive, Dropbox, Google Drive or iCloud | move the onboarding folder somewhere not synced |
| `keys`: no passphrase on Windows | no passphrase given | `--passphrase-env <VARIABLE>` (at least 12 characters) |
| `keys`: file exists, nothing written | keys generated earlier | if you mean to regenerate, archive the old files safely; the tool never overwrites |
| `validate`: invalid identifier | VKN format or checksum | VKN `TR` + 10 digits; MERSİS `TR` + 16 digits |
| `validate`: ISCED-F | code missing or not four digits | the programme's ISCED-F 2013 code; never guess a code |
| `check` N2 fails | the DNS TXT value has not propagated or was added to the wrong name | is the record on the domain itself; propagation can take hours |
| `check` K2 fails: "certificate is not for this private key" | the certificate was issued from another CSR | talk to the registrar; send the right CSR again |
| `check` M1 `404` | the metadata address does not follow RFC 8414 | `/.well-known/openid-credential-issuer/<path>` |
| `check` Q1 fails: "2xx to an unsigned request" | the lookup endpoint does not check requests | the checks in example 05: signature, caller, `aud`, expiry, `jti` |
| `check` Q1 warns: `404`/`405` | the address is not the lookup endpoint itself | correct `lookup_url` |
| `check --listing` L1 fails | the entry is not live yet | wait 24 hours, then write to the registrar |
| `check --listing` certificate not chained to the root | trial certificate or wrong environment | is `--env production` / `sandbox` right |
| First credential `INDETERMINATE` | the status list has not been published yet | try again after a few minutes |

General verification problems: [[GUIDE-0012]]. Reporting a vulnerability: `security@tamga.network`.

## Rules

| Code | What it says |
|---|---|
| [[ADR-0024]] | No entry without complete registration data |
| [[ADR-0050]] | The institution certificate carries the institution identifier, legal name and country |
| [[ADR-0057]] | With the hosted service the institution key stays with the institution; signing over the remote signing interface |
| [[ADR-0020]] | Tamga keeps no register of people; data is read from the authentic source |
| [[SPEC-ID-0002]] | Credentials are signed only with the registered certificate; certificate renewal and key change |

Package details: [@tamga-network/onboard](/packages/onboard). Conditions for taking part: [Tamga ARF — Trust Framework](https://arf.tamga.network/trust-framework).
