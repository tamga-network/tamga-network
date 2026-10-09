# Contributing

Issues and pull requests are welcome, in English or Turkish. Please do not report security issues as public issues — see
[SECURITY.md](SECURITY.md).

## Before you open a pull request

```sh
npm install
npm run setup          # development PKI, schema catalogue and trust lists (local only)
npm test
npm run typecheck
npm run format:check   # fix with: npm run format
npm run docs:check
npm run arf:check
```

CI runs the same checks.

## Code

- **Where:** `packages/` (the `@tamga-network/*` packages) and `apps/` (`verify`, `trust-publisher`). The network does not
  operate a wallet; changes to a particular wallet belong in that wallet's own repository.
- **Style:** TypeScript `strict`, ESM, relative imports with the `.js` extension. Prettier (120 columns, double quotes, LF).
  Identifiers in English.
- **Tests:** Vitest — `src/*.test.ts` in packages, `test/*.test.ts` in apps. Every bug fix comes with a test that catches it.
- **New package subpath:** add it to the package's `exports`, the root `tsconfig.json` `paths` and the `vitest.config.ts`
  aliases (the subpath key before the package key).
- **Commits:** `type(scope): summary` with types `feat fix docs refactor test chore build`; user-visible changes go into
  [CHANGELOG.md](CHANGELOG.md).

Rules that always apply (the full list is on [docs.tamga.network/rules](https://docs.tamga.network/rules)):

- No personal data in logs, audit records, trust lists, the anchor log or status list addresses.
- Trust questions are asked only through `TrustSource`; business logic never reads the list files directly.
- A verification result has three values: `ACCEPTED`, `REJECTED`, `INDETERMINATE`; an infrastructure failure is not `REJECTED`.
- Closed sets (issuer categories, credential formats, protocols) change only through a new decision record.

## Documentation

- Turkish is the source text (`docs/<path>`); the English translation lives at `docs/en/<same path>` and is updated in the
  same change (`npm run docs:check` verifies this).
- Every document has a permanent `document_id`; documents link to each other by id (`[[SPEC-CRED-0003]]`, a rule:
  `[[SPEC-CRED-0003]]/S1`).
- Glossary terms come from `docs/.vitepress/terms.json`; `INVARIANTS.md` is generated (`node scripts/sync-invariants.mjs`).
- Decisions are recorded before they are implemented; the decision records are on
  [docs.tamga.network/adr](https://docs.tamga.network/adr/).

## License

Contributions are accepted under Apache-2.0 for code ([LICENSE](LICENSE)) and CC BY 4.0 for documentation
([LICENSE-docs](LICENSE-docs)).
