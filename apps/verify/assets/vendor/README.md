# Vendored browser libraries

Served by the verifier itself (`/assets/vendor/*`) so that pages load no third-party script (CSP `script-src 'self'`).

| File | Package | Version | Licence | Source | sha384 (unchanged upstream file) |
|---|---|---|---|---|---|
| `jsQR.js` | [jsqr](https://github.com/cozmo/jsQR) | 1.4.0 | Apache-2.0 | `https://registry.npmjs.org/jsqr/-/jsqr-1.4.0.tgz` → `package/dist/jsQR.js` | `b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx` |

To update: download the new tarball, copy the file, record the new version and hash here; `test/csp.test.ts` checks the hash.
