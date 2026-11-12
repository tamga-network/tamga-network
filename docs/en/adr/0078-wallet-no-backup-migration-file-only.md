---
document_id: ADR-0078
title: "No wallet backup: the migration file is the only thing that moves"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  SPEC-WALLET-0001/WL2 said "the backup carries credentials and the manifest", and the specification described a backup encrypted
  with a key derived from a seed that could be uploaded to a Tamga-hosted store. No such backup was ever built, and ADR-0027
  forbids a server-side backup. Decision: there is no backup, and the specification is corrected to match reality. Credentials are
  bound to the hardware key on the device and do not move; on a new device credentials are issued again. The only thing the
  wallet carries is the EU TS10 migration file, started by the person and encrypted with the person's own passphrase; the file
  contains no credential values and no keys.
domain: Wallet
related: ["[[SPEC-WALLET-0001]]", "[[ADR-0027]]", "[[ADR-0031]]", "[[GUIDE-0005]]"]
translation_of: ADR-0078
source_version: 1.0.0
---

# In short

Every credential in the wallet is bound to a key that was generated in that phone's secure hardware and cannot leave it. A
credential therefore cannot be moved to another phone: even if it were moved, it could not be presented. The specification still
spoke of a "backup" of credentials. This decision removes that backup from the specification. When the phone changes, the person
gets the credentials again from the institutions; to make this easier, the wallet produces an encrypted file that carries only
the list of "which credentials do I need to get again".

# Context

- [[SPEC-WALLET-0001]] §1.3 (WL1, WL2): holder keys do not leave the secure hardware; "the backup carries credentials and the
  manifest, not the keys". §1.4, §7.1 and §7.2 described that backup: a file encrypted with a key derived from a 24-word seed,
  containing the credentials themselves, which could be uploaded to a Tamga-hosted store.
- This backup was not built. The reference wallet has no seed words, no backup file and no backup server; nor does the network
  operate a wallet service.
- [[ADR-0027]] K1 says "no server-side backup is taken", and LX2 forbids credential values, copies and keys in the migration file.
  §7.2 of the specification ("can be uploaded to a hosted store") contradicted that decision.
- The benefit of the backup was limited as well: a restored credential can be read but not presented (it has no key). In return a
  copy of the credential values exists outside the device: even encrypted, it is a leak surface, and its size reveals how many
  credentials there are.

# Decision

- **K1 — No backup.** The wallet takes no backup of credentials, copies or keys; neither off the device nor to a server. There is
  no recovery with seed words.
- **K2 — Credentials do not move, they are issued again.** Credentials are bound to the hardware key on the device. On a new
  device each credential is obtained again from its institution (new keys, new copies).
- **K3 — The migration file is the only thing that moves.** The only persistent data the wallet takes off the device is the EU
  TS10 migration file ([[SPEC-WALLET-0001]] §7.5): the list of credentials to obtain again and, if the person wants, the
  transaction log. The person starts the export, the file is encrypted with the person's passphrase and goes where the person
  chooses ([[ADR-0027]] LX1). It contains no credential values, copies or keys (LX2).
- **K4 — The rule that changes.** The text of WL2 becomes as below; the words "does not enter the server backup" in WL4 are
  removed because they refer to a backup that no longer exists (the rule itself does not change).

| Rule | Old text | New text |
|---|---|---|
| SPEC-WALLET-0001/WL2 | The backup carries credentials and the manifest; it does not carry keys — after a device change credentials have to be issued again. | The wallet takes no backup of credentials: credentials are bound to the hardware key on the device and do not move; after a device change credentials are issued again. The only thing the wallet carries off the device is the migration file started by the person (EU TS10); the file contains no credential values, copies or keys. |

# Options considered

| Option | Result | Why |
|---|---|---|
| Build the backup in the specification (seed + encrypted backup + hosted store) | rejected | A restored credential cannot be presented; a copy of credential values exists outside the device; the network operates no wallet service; contradicts [[ADR-0027]] K1 |
| A local backup that stays on the device | rejected | The migration file gives the same benefit without carrying credential values |
| **No backup; migration file** | **accepted** | The state that is implemented; in line with the EU migration rule (TS10); no credential value leaves the device |

# Consequences

- [[SPEC-WALLET-0001]]: the summary, §1.3 (WL2), §1.4, §2.1, §7.1–§7.4, §8 (WL2, the wording of WL4), the security notes and the
  open issues were corrected. WL10 (Tamga holds no recovery key) is unchanged.
- No code change: `@tamga-network/wallet-core` produces no backup; the migration file is produced by `ts10.ts`.
- The rule is the same for conforming wallets: a backup feature that takes credential values off the device violates WL2.
- The site pseudonym seed ([[ADR-0031]]) is not the subject of this decision: it stays in the device's secure store, does not
  enter the migration file (WL15), and the same value is derived again when the identity is verified again.

# Status

**Accepted — 2026-11-12.** Approved by project management (2026-11-12). DECISIONS: D-WALLET-4. Changed rule: SPEC-WALLET-0001/WL2.
