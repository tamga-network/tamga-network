# @tamga-network/onboard

Onboarding tool for institutions — for the IT team of a university, company or public body that will issue or verify credentials
on Tamga Network. It prepares and checks everything on the institution's side **before** the operator registers it, and checks
how the institution appears **after** registration:

- the application files (registration data, same rules as the operator's registration tool),
- the institution's two signing keys and the certificate requests (CSRs) — generated on your own computer,
- your own setup: domain, DNS confirmation, https addresses, `.well-known` metadata, the lookup endpoint,
- after joining: your record in the signed trust list, credential types, certificate chain to the network root,
- for a state or operator running a Besu node of the network's ledger: the node key, a configuration template, the node
  declaration and read-only checks of the running node (`tamga-onboard node`).

It **never writes to the network or the trust list** and sends nothing anywhere: its output is local files (applications, CSRs,
a report) that you send to the operator. Private keys never leave your computer. No personal data is asked for or written —
not even the name of a signatory.

The same operations are available as a local **MCP server** (`tamga-onboard mcp`, stdio), so the institution's own AI assistant
can run the steps.

## New in 0.8.3

- `--report <file>` never overwrites an existing file, requires a `.json` name and refuses a name that looks like a key or
  certificate file.
- On Windows `icacls` is called by its full path when a private key file's permissions are narrowed or checked.
- `check --report` / `node check --report` print the result first and refresh a report file that this tool wrote earlier, so
  the same command can be run again. Any other existing file is still never overwritten.

## New in 0.8.2

First published release: the institution steps (`init`, `validate`, `keys`, `check`, `sandbox`), the state / operator node
steps (`node init | declare | check`) and the local MCP server (`tamga-onboard mcp`).

## Install

Published on npm as the `0.8.3` test release (first release of this package; the stable `1.0.0` comes when everything is
ready — in test releases the commands and options may change). Released together with the other `@tamga-network/*` packages.
This first release is published by hand without npm provenance (npm's trusted publishing from GitHub Actions can only be set
up for a package that already exists); later releases are built by GitHub Actions and carry provenance.

```sh
npm install -g @tamga-network/onboard     # or: npx -p @tamga-network/onboard tamga-onboard --help
```

Node.js 22 or later. No `openssl` needed. In a clone of this repository it also runs from source without a build step:
`npm install`, then `npx tsx packages/onboard/src/cli.ts` in place of `tamga-onboard` (the compiled `lib/cli.js` is meant for
the published package).

## Steps

```sh
tamga-onboard init                       # questions → tamga-onboarding/<slug>/ (or: init --from answers.json)
tamga-onboard keys tamga-onboarding/<slug>
tamga-onboard check tamga-onboarding/<slug> --report report.json
# send to the operator: <slug>.issuer.json, <slug>.rp.json (if any), keys/*.csr.pem, report.json — never keys/*.key.pem
# after registration (up to 24 hours):
tamga-onboard check tamga-onboarding/<slug> --listing
```

| Command | What it does |
|---|---|
| `init [--from <answers.json>] [--out <dir>]` | Asks for (or reads) the institution's data and writes `onboarding.json` + the registration application(s). Unknown fields are rejected, so names of people cannot slip in. |
| `validate <file\|dir> …` | Checks an application, an answers file or an onboarding folder with the registration rules (ADR-0024) plus identifier format and checksum, https addresses, ISCED-F codes. |
| `keys [dir] [--passphrase-env <VAR>] [--no-passphrase] [--allow-synced]` | Generates the keys (issuer: credential + status list; verifier: access) as P-256 / ES256 on this computer, writes `keys/<name>.key.pem` (owner-only permissions; passphrase of at least 12 characters — on Windows required unless `--no-passphrase`) and `keys/<name>.csr.pem`. Refuses a folder synced to OneDrive, Dropbox, Google Drive or iCloud unless `--allow-synced`. The CSR subject carries the legal name, country and `organizationIdentifier` (`VATTR-<VKN>` / `NTRTR-<MERSIS>`); an access-certificate CSR also carries the DNS name and the support address. Never overwrites. |
| `keys --inspect <csr.pem> [dir]` | Checks a CSR made elsewhere (HSM, remote signing service) against your application. |
| `check [dir]` | Your setup: applications, keys ↔ CSRs ↔ certificates from the operator, domain and DNS TXT confirmation (`--dns-txt <value>`), https addresses, own-service metadata, lookup endpoint (probed with invalid requests only), verifier domain. Only https; redirects are followed hop by hop and local / private network addresses are refused (`--allow-http`, `--allow-private` for local tests). |
| `check [dir] --listing` · `check --listing-only --env sandbox --slug <slug>` | Your record in the signed trust list, verified against the root pins embedded in this package (`--pin <hex>` overrides with a value you verified out of band at tamga.network/trust-anchor; the report then shows a warning row). Registration certificates are downloaded and their signature checked against the registrar keys in the signed list. |
| `sandbox` | Where and how to try the sandbox ("Try your institution"). |
| `mcp [--root <dir>]` | Local MCP server (stdio) with the tools below. |

Exit codes: `0` ok · `1` a check or validation failed · `2` usage error. `--json` prints the report as JSON.

## State / operator node (`tamga-onboard node`)

For a state (or another operator) that runs a node of the network's Besu ledger. Nothing is written to the chain, the
allowlist or the network: votes, allowlist reloads and peer changes stay with the operators.

```sh
tamga-onboard node init --state TR --role validator --ip 192.0.2.10 --interface 10.0.0.10 --out /var/lib/besu
tamga-onboard node declare /var/lib/besu --contact noc@example.org        # → tr-validator.json, send to the operator
# after genesis.json, static-nodes.json and the allowlist are in place and the node runs:
tamga-onboard node check /var/lib/besu --chain-rpc https://<operator endpoint> --permissions-file permissions_config.rendered.toml
```

| Command | What it does |
|---|---|
| `node init --state <CC> --role validator\|rpc --ip <IP> [--interface <IP>] [--p2p-port 30303] [--rpc-port 8545] [--out <dir>] [--allow-synced]` | Generates the node key (secp256k1) **on the node's own machine** and writes `key` (Besu key file format, owner-only permissions; refused in a folder synced to OneDrive, Dropbox, Google Drive or iCloud unless `--allow-synced`; never overwritten), `key.pub`, `node.json` and a `besu.toml` template. Prints the enode public key and the validator address (the address Governance must hold for the state). The template: permissioned mode (both allowlist flags on), JSON-RPC on 127.0.0.1 only (QBFT, PERM, ADMIN for the node's own use; outside clients get ETH, NET, WEB3 only through `network/rpc-proxy`), P2P listening on one internal interface (`p2p-interface`; `0.0.0.0` / `::` are refused — without it Besu listens on every interface) and advertising `--ip` (`p2p-host`), discovery off, WebSocket and GraphQL off. Genesis is neither generated nor downloaded: it comes from the network's operators and its sha256 is compared out of band with at least two of them. |
| `node declare [dir] --contact <role address> [--name <name>] [--out <file>]` | Writes the `tamga-node-declaration/1` file (schema `network/permissions/schema/node-declaration.schema.json`) the operator adds to `network/permissions/nodes/`. The contact is the institution's operations mailbox or https page — no personal names (an address that does not look like a role mailbox gets a warning). Without a node folder (key in an HSM): `--public-key --state --role --ip --p2p-port`. A declaration grants no authority. |
| `node check [dir] [--rpc <url>] [--chain-rpc <url>] [--public-rpc <url>] [--permissions-file <toml>] [--config <besu.toml>] [--declaration <json>] [--client-cert <pem> --client-key <pem>] [--allow-private] [--json] [--report <file>]` | Read-only checks of your own node (only read-only JSON-RPC methods are ever called): reachable (N1), in sync and same genesis as a reference endpoint (N2–N3), peers (N4), running key = `node.json` / declaration (N5), node and account allowlists = the rendered file of `trust:chain-permissions render` and the reference endpoint (N6), in the validator set (N7), the external endpoint refuses `admin_`, `perm_`, `qbft_`, `debug_`, `txpool_` and `eth_accounts` but answers `eth_blockNumber` / `net_version` (N8), `besu.toml` interfaces and permissioning flags (N9), clock against the latest block (N10). |

Addresses are only the ones you type; nothing is read from a file except the local RPC port in `besu.toml`. Loopback is
allowed by default (you check your own node, whose admin endpoint listens on 127.0.0.1 by design); other local / private
networks — RFC 1918, link-local (cloud metadata), CGNAT, ULA — need `--allow-private`, also after name resolution; plain http
only to loopback / private addresses; redirects are not followed. Declaration matching, block proposal, voting and account-permission checks
need operator rights and stay with the operator.

### Answers file (`init --from`)

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

`hosting: "own"` (your own issuing service) needs `issuer_url` and `status_list_base`. A verifier (`"role": "verifier"`) gives
`dns_name`, `service_description`, `is_public_sector_body` and `scopes` (purpose, credential type, the fewest fields, privacy
policy per use).

## MCP server

```json
{ "mcpServers": { "tamga-onboard": { "command": "npx", "args": ["-y", "-p", "@tamga-network/onboard", "tamga-onboard", "mcp"] } } }
```

From source (in a clone of this repository): `"command": "npx", "args": ["tsx", "<repo>/packages/onboard/src/cli.ts", "mcp", "--root", "<folder>"]`.

Tools: `create_application`, `validate_application`, `generate_keys_and_csr`, `check_installation`, `check_listing`,
`sandbox_info`, and for a node `generate_node_key`, `create_node_declaration`, `check_node`. File access is limited to the server's root folder (`--root`, default the working directory), also after
symbolic links and junctions are resolved; private key content is never returned (only paths and public-key digests); a
passphrase is given only as the name of an environment variable starting with `TAMGA_`; root pins cannot be overridden and
local network addresses are never read; request addresses outside the institution's domain are flagged; check results mark
text read from the network as untrusted data. The node key is never returned and is never written to a synced folder over
MCP; `check_node` reaches loopback / private addresses only if their origin is listed in the server's
`TAMGA_ONBOARD_PRIVATE_NODES` environment variable (comma-separated, e.g. `http://127.0.0.1:8545`), public ones only over https.

## Security notes

- In production, generating the keys in an HSM or a remote signing service is preferred; then use `keys --inspect` on the CSR
  it produces. Keys generated by this tool are software keys — keep them owner-only and backed up.
- The lookup endpoint is only probed with requests that must be refused; no record, real or invented, is involved.
- The trust list is read only over https and verified against embedded pins; nothing the network says is executed.

## Türkçe

Kurumun bilgi işlem ekibi için katılım aracı: başvuru dosyasını hazırlar ve kayıt kurallarıyla denetler, kurumun iki anahtarını
**kendi bilgisayarında** üretip operatöre gidecek CSR'ları yazar, kurulumu (alan adı, DNS teyidi, meta veri, sorgu ucu) ve
katıldıktan sonra güven listesindeki görünümü denetler. Ağa ve listeye yazmaz; kişi bilgisi sormaz ve yazmaz; özel anahtar
bilgisayardan çıkmaz. Sıra: `init` → `keys` → `check --report` → dosyaları operatöre gönder → kayıttan sonra `check --listing`.
Aynı işlemler `tamga-onboard mcp` ile yerel MCP sunucusu olarak da kullanılır.

**Devlet / işletmeci düğümü** (`tamga-onboard node`): `node init` düğüm anahtarını (secp256k1) düğümün kendi makinesinde üretir
(yalnız sahibine okunur, bulut eşitleme klasörüne yazılmaz, üzerine yazılmaz), enode açık anahtarını ve validator adresini
gösterir, `besu.toml` şablonunu yazar (izinli kip; RPC yalnız 127.0.0.1; P2P yalnız belirli iç arayüzde — 0.0.0.0 değil;
keşif kapalı). Genesis araçla üretilmez: işletmecilerden alınır, özeti en az iki işletmeciyle bant dışı karşılaştırılır.
`node declare` operatöre gidecek `tamga-node-declaration/1` bildirimini yazar (iletişim kurumun görev adresi; kişi adı yok).
`node check` çalışan düğümü yalnız okuyarak denetler: senkron ve aynı genesis, eşler, anahtar, izin listesi (çizimle ve
karşılaştırma ucuyla), validator kümesi, dış uçta yalnız eth/net/web3, yapılandırma, saat. Zincire, izin listesine, ağa yazmaz;
oy ve izin yükleme işletmecilerde kalır. MCP araçları: `generate_node_key`, `create_node_declaration`, `check_node`. Sandbox denemesi için başvuru gerekmez:
`tamga-onboard sandbox`. Paket npm'de `0.8.3` deneme sürümü olarak yayımlanmıştır:
`npm install -g @tamga-network/onboard` ya da `npx -p @tamga-network/onboard tamga-onboard --help`; Node.js 22 ve üstü.

Docs: https://docs.tamga.network · Source: https://github.com/tamga-network/tamga-network (packages/onboard) · Apache-2.0
