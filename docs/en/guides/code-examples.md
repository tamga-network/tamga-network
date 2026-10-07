---
document_id: GUIDE-0004
title: "Code examples"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-07
summary: >
  Four working examples: sign-in with Tamga on a website, verifying credentials on your own server, issuing credentials as
  an institution and checking an institution's authorisation. The code is pulled into this page from the real files in the
  `examples/` folder and runs in every test, so the code on this page cannot drift from the packages.
translation_of: GUIDE-0004
source_version: 1.0.0
---

# Code examples

This page shows Tamga's four basic uses with code you can copy and run.

**When to read:** after a guide, when you want to see working code — or if you simply prefer to start from code. Each example
links to the guide that explains it.

The code below is the **real files** in the `tamga-network/examples/` folder: on every test run they are exercised end to end
with the real packages (and, where possible, the real verifier). That is why the code on this page cannot drift from the
packages.

## Installation

::: code-group

```sh [npm]
npm install @tamga-network/verifier @tamga-network/trust @tamga-network/issuer
```

```sh [pnpm]
pnpm add @tamga-network/verifier @tamga-network/trust @tamga-network/issuer
```

```sh [yarn]
yarn add @tamga-network/verifier @tamga-network/trust @tamga-network/issuer
```

:::

::: tip Version
The packages are at version 1.0.0; they are published on npm with the go-live announcement. They can also be used from
the source repository (`npm run release:check` builds publish-ready packages in the `.publish/` folder).
:::

| What do you want to do? | Package | Import |
|---|---|---|
| Sign in with Tamga on your website | `@tamga-network/verifier` (+ page kit `/web`) | `import { createRpAssertion } from "@tamga-network/verifier"` |
| Verify credentials on your own server | `@tamga-network/verifier`, `@tamga-network/trust` | `import { verifyPresentation } from "@tamga-network/verifier"` |
| Issue credentials as an institution | `@tamga-network/issuer` | `import { createIssuerClient } from "@tamga-network/issuer/client"` |
| Check an institution's authorisation | `@tamga-network/trust` | `import { fetchListTrustSource } from "@tamga-network/trust"` |

## 1. "Sign in with Tamga" on a website

**Your site's server** opens the presentation (with a short-lived statement signed with the key in your [[t:trust-list]]
entry). The page only shows the QR code and watches the state; the approved values are given to your server once
([[ADR-0017]]). Details: [[GUIDE-0001]].

::: code-group

<<< @/../examples/01-web-login/server.ts [server.ts]

<<< @/../examples/01-web-login/page.html [page.html]

:::

## 2. Verifying credentials on your own server

Without the hosted [[t:verifier]]: it verifies the trust lists, prefetches the [[t:status-list|status lists]], produces a
signed request, decrypts the encrypted answer and runs the verification pipeline (T0 + A–E). The result has three values:
`ACCEPTED`, `REJECTED`, `INDETERMINATE` ("could not be checked right now" — it does not mean the credential is invalid).
Details: [[GUIDE-0002]].

<<< @/../examples/02-verify-own-server/verifier.ts

## 3. Issuing credentials as an institution (hosted service)

With the scoped API key the Tamga operator gives your institution ([[ADR-0016]]). The offer link is shown as a QR code; the PIN
goes over a separate channel and never inside the link. Details: [[GUIDE-0003]].

<<< @/../examples/03-issue-hosted/issuer.ts

## 4. Checking an institution's authorisation

Is an institution (an [[t:issuer]]) registered in the trust list, is it active, may it issue this credential type? No personal
data involved. Details: [[GUIDE-0006]].

<<< @/../examples/04-check-institution/check.ts

## Running the examples

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install && npm run setup           # development PKI + trust lists
npx vitest run examples             # four examples, with the real packages
```
