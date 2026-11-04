# @tamga-network/onboard

Joining tool for institutions — for the IT team of a university, company or public body that will issue or verify credentials
on Tamga Network. It prepares and checks everything on the institution's side **before** the operator registers it, and checks
how the institution appears **after** registration:

- the application files (registration data, same rules as the operator's registration tool),
- the institution's two signing keys and the certificate requests (CSRs) — generated on your own computer,
- your own setup: domain, DNS confirmation, https addresses, `.well-known` metadata, the lookup endpoint,
- after joining: your record in the signed trust list, credential types, certificate chain to the network root.

It **never writes to the network or the trust list** and sends nothing anywhere: its output is local files (applications, CSRs,
a report) that you send to the operator. Private keys never leave your computer. No personal data is asked for or written —
not even the name of a signatory.

The same operations are available as a local **MCP server** (`tamga-onboard mcp`, stdio), so the institution's own AI assistant
can run the steps.

## Install

> **Not yet on npm.** The package is built and checked with the others but is not part of the 0.8.1 publication; its first
> publish comes later. Until then, run it from this repository (`npm run build:packages`, then `node packages/onboard/lib/cli.js`).

```sh
npm install -g @tamga-network/onboard     # or: npx -p @tamga-network/onboard tamga-onboard --help
```

Node.js 22 or later. No `openssl` needed.

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

Tools: `create_application`, `validate_application`, `generate_keys_and_csr`, `check_installation`, `check_listing`,
`sandbox_info`. File access is limited to the server's root folder (`--root`, default the working directory), also after
symbolic links and junctions are resolved; private key content is never returned (only paths and public-key digests); a
passphrase is given only as the name of an environment variable starting with `TAMGA_`; root pins cannot be overridden and
local network addresses are never read; request addresses outside the institution's domain are flagged; check results mark
text read from the network as untrusted data.

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
Aynı işlemler `tamga-onboard mcp` ile yerel MCP sunucusu olarak da kullanılır. Sandbox denemesi için başvuru gerekmez:
`tamga-onboard sandbox`. Paket henüz npm'de değildir (ilk yayın sonra); o zamana dek bu depodan çalıştırılır.

Docs: https://docs.tamga.network · Source: https://github.com/tamga-network/tamga-network (packages/onboard) · Apache-2.0
