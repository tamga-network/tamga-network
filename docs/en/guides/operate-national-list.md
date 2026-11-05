---
document_id: GUIDE-0017
title: "Operate a national trust list"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  The setup guide for the chainless mode: for the IT team that will run a country's signed trust list — keys and the root
  certificate (HSM note), the registry, producing, signing, verifying and publishing the list with the list publisher
  (trust-publisher; JSON-JWS, ETSI TS 119 612 XML and TS 119 602 LoTE views), getting into the LOTL, the publication server (HTTPS,
  CORS, cache headers), hourly jobs and monitoring, the institution onboarding loop, anchoring when the chain is on, and hand-over.
  It follows the set-up that runs the Türkiye list today.
translation_of: GUIDE-0017
source_version: 1.0.0
---

# Operate a national trust list

This guide is for the **IT team** of the public body that will run its country's [[t:trust-list]] (the [[t:TLSO]], list operator).
It explains step by step where the keys live, how the list is produced and signed, from where and with which headers it is
published, and how day-to-day operation is monitored.

Today Tamga Network runs the Türkiye list (`tl-tr.jws`) on the country's behalf; this guide follows that set-up. A state that
will publish its own list later uses the same tools and the same steps.

**When to read:**
- When your country prepares to run its own list or to take over the list run on its behalf, before the infrastructure is built.
- Before: [[GUIDE-0016]] (two modes: signed lists and a shared ledger) and [[GUIDE-0011]] (connecting your list to the network:
  LOTL entry, roles, recognition, the external list path). This guide is the setup and operations side of [[GUIDE-0011]].
- Concepts: [Trust lists](/concepts/trust-lists), [ETSI trusted list view](/concepts/etsi-trusted-list).

Places are reserved for the states named or coded in this document; this is not a notice of an agreement or of talks.

## The big picture

Running a list means running a few small parts on a schedule. None of them is an always-on application server: the list
publisher is a command-line tool, and publication is serving static files.

```text
registry (JSON source)            keys (outside the repository; root offline)
          │                                │
          └────────── trust:build ─────────┘   produces and signs the list
                           │
                           ▼
               dist/  lotl.jws · tl-<cc>.jws · anchors.jsonl · keys/ · archive/ · CHANGELOG.md
                           │                        (+ optional: tl-<cc>.xml, lote/*.jws)
                           ▼
            publication server (HTTPS, static)  ──▶  wallets and relying parties download
                           ▲
            hourly: trust:heartbeat (anchor log line)   ·   monitoring: freshness, signature, reachability
```

| Part | What | Where |
|---|---|---|
| National root certificate (root CA) | The root of institution certificates | **Offline**; in an HSM or a safe |
| List signer | Signs the list and the anchor log | On the publishing machine, readable only by the publisher |
| Registrar signer | Signs each [[t:registration-certificate]] | On the publishing machine |
| Registry | Source records of institutions, relying parties and root certificates (JSON) | Under version control (e.g. git) |
| List publisher | `apps/trust-publisher` — an open-source command-line tool | Publishing machine |
| Publication server | Serves the produced files over HTTPS | Any web server |

::: info Terms
- **JWS** (JSON Web Signature): the signed form of JSON data. Lists are `.jws` files; the readable copy of the same content is `.json`.
- **ETSI TS 119 612**: the EU's trusted list standard in XML (XAdES-signed). **ETSI TS 119 602** ([[t:LoTE]]): the "list of trusted
  entities" standard carrying the same information in JSON. In Tamga both are **views** of the same signed source, not separate lists.
- **HSM** (Hardware Security Module): hardware that signs without ever releasing the private key.
- **Pinning**: wallets and relying parties writing the root key's fingerprint into their configuration once.
:::

## 1. Keys and the root certificate

All keys are P-256 with ES256.

| Key | Signs | Rule |
|---|---|---|
| `root-ca` | Institution and relying party certificates | Offline; brought online only to issue certificates |
| `tl-signer-1` (and a second one for rollover) | `tl-<cc>.jws`, the anchor log | At least two rolling signers; a change is announced at least 30 days ahead and the new key is signed by the old one (RB-OP-05) |
| `registrar-1` | Registration certificates and their status list | The key of the registrar role |
| `tl-xml-signer-1` | The ETSI XML view only | ETSI TS 119 612 §5.7.1 profile: C and O in the subject, `keyUsage` digitalSignature + nonRepudiation, not a CA, EKU `id-tsl-kp-tslSigning` ([[ADR-0066]]) |

The Türkiye list is published today with a single list signer; the two-signer rule (RB-OP-05) is a declared, temporary deviation.

**Real keys never go into the repository.** The tools use the real network's key folder only when it is given explicitly
(`TAMGA_PROD_PKI_DIR`) and refuse a folder inside the repository:

```sh
# produces missing leaves (e.g. the XML signer); does not produce the root, never overwrites, refuses --force
TAMGA_PROD_PKI_DIR=<secret folder> npx tsx ops/gen-pki.ts --prod
```

::: warning The root key ceremony happens outside these tools
`gen-pki.ts --prod` stops if the folder has no root: a real root is never generated by this tool, because if the root changes
every wallet and relying party has to pin again. Generate the national root under your own rules, in a witnessed key ceremony,
inside an HSM; keep the private key offline.
:::

**HSM note.** Today's list publisher reads the signing keys from PKCS#8 files in the key folder; the tool has no HSM integration.
So only the account the publisher runs as may read the folder, and access must be limited to two people and logged
([[ADR-0009]]). If you want to keep the list signer in an HSM, plan moving the signing step into the HSM together with the network
operator. Institutions' own signing keys always stay **with the institutions**; the list operator does not hold them (RB-OP-08,
[[ADR-0057]]).

**Root fingerprints.** The publisher writes `keys/root-fingerprints.json` on every publication. The same values are published,
identically, on a permanent page (in Tamga, `tamga.network/trust-anchor`), in the framework document and in contract annexes
(RB-OP-06).

## 2. The registry

The list's source is the JSON files in the list publisher's `registry/` folder:

| File | Content |
|---|---|
| `tl-tr.source.json` | National list: `state_code`, `next_update_days`, `operator`, `root_cas`, `issuers`, `relying_parties`, `national_schemas` |
| `lotl.source.json` | List of lists: country entries (`national_lists`), wallet providers, external lists, view settings |
| `examples/` | Example application files (issuer, relying party, external list) |
| `pending/` | Pending applications |

Rules:

- **Do not edit by hand.** The registry commands (§7) check every field against the registration rules ([[ADR-0024]]), append
  the change to `status_history` and never delete a row.
- **No personal data.** The registry, the list, the anchor log and the change log carry no names of people or personal data;
  contact addresses are institutional role addresses.
- **Version control.** Every change to the source files is committed to version control; the list itself is signed on the
  publishing machine where the signing key is. The registry commands do not sign the list.

Folders can be changed with environment variables: `TAMGA_TP_REGISTRY` (registry), `TAMGA_TP_PKI` (key folder), `TAMGA_TP_DIST`
(output).

::: tip Today the tool is written for one country list
The list publisher produces the LOTL together with **one** country list from one registry; the country list's source file is named
`tl-tr.source.json`, and the `state_code` inside it decides the output name (`tl-<cc>.jws`). A state running its own list runs
the tool in its own copy with its own registry and keys; the LOTL it produces is only for local checks, the network's LOTL is
signed by the network operator (§4). Adapting the file names and the country code is done at setup together with the network
operator.
:::

## 3. Producing, signing and verifying the list

You need Node.js 22 and Git. First try everything locally, with development keys:

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install
npm run setup     # development PKI → schema catalogue → lists → heartbeat → verification (keys in ops/pki/, never committed)
```

On the real publishing machine:

```sh
npm run schemas:build                                   # credential type catalogue (read by the publisher)
TAMGA_TP_PKI=<secret folder> npm run trust:build         # produces, signs and archives the lists
npm run trust:verify -- --full                           # verifies the publication with the loader (full chain with the archive)
```

Every time `trust:build` runs it:

- increases the version by one and writes the digest of the previous version (`previous_version_hash`); the version never goes back;
- sets `next_update` `next_update_days` ahead (at most 90 days, RB-OP-03);
- writes the old version to `archive/` and the change to `CHANGELOG.md`;
- writes files atomically (first a temporary file, then a rename): the server never serves a half-written list.

The list is re-signed regularly even when nothing changes; a change must be published within 24 hours at the latest (RB-OP-03).

**Produced files:**

| File | What |
|---|---|
| `lotl.jws`, `lotl.json` | The list of lists (signed + readable copy) |
| `tl-<cc>.jws`, `tl-<cc>.json` | The national list |
| `anchors.jsonl` | The hourly signed [[t:anchor-log]] |
| `keys/` | Certificates the list refers to (public certificates only) and `root-fingerprints.json` |
| `wrprc/`, `status/wrprc/1` | Registration certificates and their status list (re-signed hourly) |
| `archive/` | Old list versions and anchor log archives (never deleted) |
| `CHANGELOG.md` | Who changed what, when (RB-OP-07) |
| `tl-<cc>.xml`, `tl-<cc>.sha2` | ETSI TS 119 612 XML view and its SHA-256 digest (when enabled) |
| `lote/*.jws`, `lote/*.json` | ETSI TS 119 602 LoTE view (when enabled) |

### Views: JSON-JWS, ETSI XML, LoTE

The source is always the JSON-JWS list. Both ETSI views are produced from the same source **with the same version number**; if a
view contradicts the source, the source prevails.

| View | How to enable | Today |
|---|---|---|
| ETSI TS 119 612 XML (XAdES-B-B) | `TAMGA_TL119612=1` and `TAMGA_TL119612_SIGNER=tl-xml-signer-1` | On in the sandbox; on the real network once postal addresses and the production XML signing certificate are in place |
| ETSI TS 119 602 LoTE (JSON) | `"lote": { "enabled": true }` in `lotl.source.json` | Off; once the URI names and the operator's postal address are approved |

```sh
TAMGA_TP_PKI=<secret folder> TAMGA_TL119612=1 TAMGA_TL119612_SIGNER=tl-xml-signer-1 npm run trust:build
```

On the real network the publication stops if the XML signer does not match the profile or required publication data such as a
postal address is missing; in the sandbox this is a warning. The XML signer's fingerprint is published in the LOTL in the country
entry's separate `xml_signing_keys` field and is never mixed with the JSON signer. The definition URIs in the XML list:
[ETSI trusted list view](/concepts/etsi-trusted-list).

## 4. Getting into the LOTL

Your list becomes valid on the network the moment your country's entry in the Tamga LOTL points to it. The network operator signs
the LOTL; this step is done with them ([[GUIDE-0011]] §A):

1. Fix the permanent HTTPS address of your list (`list_url`, e.g. `https://trust.example.gov/tl-xx.jws`).
2. Give the network operator the **public certificate** of your list signer (the private key is never handed over); if you publish
   the XML view, the XML signer's certificate too.
3. Write the roles (`tlso`, `registrar`, `access_ca`, `national_root_ca`) and the recognition setting (`recognition`) together.
4. The network operator publishes a new LOTL version. Find your entry in the published `lotl.json`, then verify your list with
   the loader: the signature must chain to the signer in the LOTL, and institution certificates to the root in your list.

On hand-over (taking over a list run on your behalf) only the operator, the address and the signers change in the same entry;
institutions' identifiers (`issuer_id`, `ca_id`) and credential types do not change, and credentials already issued stay valid
(RB-OP-14, [[ADR-0035]] PO3).

## 5. The publication server

The list is static files; any web server will do. No application server, database or session is needed.

| Topic | Rule |
|---|---|
| Transport | HTTPS only; HSTS on; HTTP requests are redirected to HTTPS |
| CORS | `Access-Control-Allow-Origin: *` — the lists are public and verifiers in browsers read them too |
| Caching | Lists 5 minutes (`public, max-age=300`); anchor log and status list 60 seconds; `archive/` 1 day, `immutable` |
| Content types | `.jws` → `application/jose`; `.json` → `application/json`; `.jsonl` → `application/x-ndjson`; `.pem` → `application/x-pem-file`; `.xml` → `application/vnd.etsi.tsl+xml`; `.sha2` → `text/plain`; `status/` → `application/statuslist+jwt` |
| Temporary files | `*.tmp` is never served (the publisher's atomic writes) |
| Source folder | If the server reads straight from the publisher's output folder, hourly anchor lines are live at once; if you use a separate copy, sync it after every `trust:build` and `trust:heartbeat` |

The cache time is independent of `next_update`: the list itself states its freshness, caching only lowers server load. Keep it
short so that a change reaches everyone within minutes.

Example for nginx (the domain and the folder are yours):

```nginx
server {
    listen 443 ssl http2;
    server_name trust.example.gov;
    root /var/lib/trust-publisher/dist;

    types {
        application/jose jws;  application/json json;  application/x-ndjson jsonl;
        application/x-pem-file pem;  application/vnd.etsi.tsl+xml xml;  text/plain sha2;  text/markdown md;
    }
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Access-Control-Allow-Origin "*" always;
    add_header Cache-Control "public, max-age=300" always;

    location ~ \.tmp$ { return 404; }
    location = /anchors.jsonl {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "public, max-age=60" always;
    }
    location ^~ /status/ {
        types { } default_type application/statuslist+jwt;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "public, max-age=60" always;
        try_files $uri =404;
    }
    location /archive/ {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "public, max-age=86400, immutable" always;
        try_files $uri =404;
    }
    location / { try_files $uri =404; }
}
```

In nginx, once a `location` has its own `add_header`, the headers of the outer block are not inherited there; that is why the CORS
header is repeated in every location.

Check the headers after publishing:

```sh
curl -sI https://trust.example.gov/tl-xx.jws          # 200, application/jose, CORS, Cache-Control
curl -s  https://trust.example.gov/tl-xx.json | head  # version, next_update, previous_version_hash
```

## 6. Hourly jobs and monitoring

| Job | When | Command |
|---|---|---|
| Anchor log line | Every hour (even without changes, RB-OP-04) | `npm run trust:heartbeat` — also re-signs the registration certificate status list |
| List re-signing | On every change and regularly (before `next_update` gets close) | `npm run trust:build` + `npm run trust:verify` |
| Anchor log archive | Automatically (at 500 lines; `TAMGA_ANCHORS_MAX_LINES`), or by hand | `npm run trust:archive` |

Tie the hourly job to a timer. An example for systemd:

```ini
# trust-heartbeat.service
[Service]
Type=oneshot
User=trust-publisher
WorkingDirectory=/opt/tamga-network
Environment=TAMGA_TP_PKI=<secret folder>
ExecStart=/usr/bin/npm run -s trust:heartbeat
NoNewPrivileges=true

# trust-heartbeat.timer
[Timer]
OnCalendar=hourly
Persistent=true
RandomizedDelaySec=60
[Install]
WantedBy=timers.target
```

**Monitor** (every few minutes; alerts by email or into your own monitoring system):

- **List freshness:** alert if `next_update` is less than 12 hours away. If the date passes, verifiers return `INDETERMINATE`.
- **Anchor log:** if the last line is older than 2 hours, the hourly job has stopped.
- **Registration certificate status list:** alert if less than half of its validity remains.
- **Reachability:** every file returns 200 with the right content type and CORS header; alert if the TLS certificate expires in
  less than 14 days.
- **Signature:** `trust:verify` after every `trust:build`; if it fails, stop the publication — the old list stays valid until its
  `next_update`.

The list publisher is a single point of failure: if it stops, verification continues from the cached list until `next_update`,
then becomes `INDETERMINATE`. That is why a written operations manual and two-person access are mandatory ([[ADR-0009]]).

## 7. The institution onboarding loop

Institutions and relying parties prepare their applications on their own side with the onboarding tool ([[GUIDE-0014]]); as the
registrar you check them, issue certificates and write them into the list.

```text
institution: tamga-onboard init / keys  →  application file + certificate signing request (CSR)
you:         certificate from the CSR  →  trust:register  →  trust:authorize  →  trust:build  →  trust:verify  →  publish
institution: tamga-onboard check --listing  →  checks its record in the list
```

```sh
# 1. Institution certificate (root-signed; the institution's key stays with it, only the CSR comes in)
TAMGA_CONFIRM_PROD=<institution short name> TAMGA_PROD_PKI_DIR=<secret folder> \
  npx tsx ops/pki-issue.ts --prod --name issuer-<institution short name> --csr <request.csr.pem> --org-id VATTR-<tax no>

# 2. Registration and authorisations
npm run trust:register -- issuer <application.json>   # reports all missing fields at once
npm run trust:authorize -- <slug> <vct>              # credential type authorisation (--revoke ends it)
npm run trust:register -- rp <application.json>       # relying party
npm run trust:scope -- <dns_name> <use.json>         # a new use for a relying party

# 3. Status changes (records are never deleted)
npm run trust:status -- <slug> SUSPENDED --reason <reason>
npx tsx apps/trust-publisher/src/cli.ts rp-status <dns_name> <status>
npm run trust:list                                   # registered institutions and relying parties

# 4. Publish
TAMGA_TP_PKI=<secret folder> npm run trust:build && npm run trust:verify
```

`TAMGA_CONFIRM_PROD` is a deliberate gate: the real root signs only when the value matches the institution the certificate is
for. Application formats and required registration data: [[GUIDE-0007]] (issuer), [[GUIDE-0008]] (relying party). The steps on
the institution's side: [[GUIDE-0014]].

When an institution is withdrawn its record is not deleted; its status changes. A record that should never have been valid is
withdrawn with `--invalidates-from valid_from`: no credential issued by that institution verifies.

## 8. When the chain is on

The chain is off in production today; this section is written for that day ([[GUIDE-0016]]). The list is still the source and
every step above stays the same. The added job is to write the **digest** of the list and of the anchor log to the list anchor
registry on the chain after every publication:

```sh
npm run trust:chain-submit -- --dry-run   # prints the plan, writes nothing (no connection while the flag is off)
npm run trust:chain-submit                 # verifies the dist/ set and writes digests only
npm run trust:chain-check -- dist/tl-xx.jws   # is your list digest confirmed on the chain: YES / NO / UNKNOWN
```

| Environment variable | What |
|---|---|
| `TAMGA_CHAIN_ENABLED` | Default `0`: no connection to the chain, nothing is written |
| `TAMGA_CHAIN_RPC_URL` | The RPC address of your own full node |
| `TAMGA_CHAIN_ANCHOR_REGISTRY` | The address of the list anchor registry |
| `TAMGA_CHAIN_ANCHORER_KEY` | The writer key, with write permission only |

- An unhealthy set (broken signature or version chain) is never anchored.
- The same version with the same digest is not written twice (`SKIP`); a different digest for a confirmed version gives
  `CONFLICT`, is not written and the command ends with an error code: something you must look at.
- An anchor is confirmed only when a threshold of independent writers submit the same digest; in production the threshold is at
  least 2.
- Before opening the chain (2026-11-05): every consumer that reads the list (verifiers, wallets, issuer services) must run a
  loader of at least `@tamga-network/trust` **0.8.1**. With the flag on, new line types (`registration_status`, `list_view`) are
  written to the anchor log; an older loader stops on an unknown line type ([[SPEC-TRUST-0001]] §5).

Your state's validator node and the work next to the chain: [[GUIDE-0015]]. Step-by-step setup of the test network:
[[GUIDE-0018]].

## Troubleshooting

| Symptom | Cause | What to do |
|---|---|---|
| Verifiers get `INDETERMINATE` | `next_update` has passed or the list cannot be downloaded | `trust:build` + publish; check the server and TLS |
| `trust:verify` signature error | Wrong key folder, or a certificate that does not match the signer in the LOTL | Check `TAMGA_TP_PKI` and the fingerprint in the LOTL entry |
| `trust:build` stops at the XML step | The XML signer does not match the profile or a postal address is missing | Complete the `tl-xml-signer-1` profile and the addresses in the record, or keep XML off |
| A verifier in a browser cannot read the list | Missing CORS header | `Access-Control-Allow-Origin: *` in every `location` |
| The anchor log has had no new line for 2 hours | The timer has stopped | Look at the timer's log; run `trust:heartbeat` by hand |

## Rules

| Code | What it says |
|---|---|
| RB-OP-02 | Versions increase monotonically and carry the previous digest; no row is deleted |
| RB-OP-03 | `next_update` at most 90 days; a change is published within 24 hours |
| RB-OP-04 | The anchor log is signed hourly; no line is deleted |
| RB-OP-05 | At least two rolling signers; a change is announced 30 days ahead |
| RB-OP-06 | Root fingerprints are published with the same values everywhere |
| RB-OP-08 | The operator does not hold institutions' signing keys |
| RB-OP-14 | On hand-over only the operator changes; `ca_id`, `issuer_id`, `vct` do not |
| [[SPEC-TRUST-0001]] TL11 | The list, the anchor log and the change log carry no personal data, credentials or credential digests |
| [[ADR-0051]] CH5 | While the chain flag is off there is no connection to the chain; in production it is not turned on without a second independent operator and a threshold ≥ 2 |

All rules for the list operator: [Tamga ARF — Tamga Rulebook, RB-OP](https://arf.tamga.network/rulebook).
