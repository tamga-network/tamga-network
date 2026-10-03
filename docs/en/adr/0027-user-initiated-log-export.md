---
document_id: ADR-0027
title: "Exporting the transaction log"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  SPEC-WALLET-0001/WL4 requires the presentation log never to leave the device. The EU (CIR 2024/2979 Art. 9 and 13, TS10) requires
  the wallet to export its transaction log and a migration object at the person's request. Decision: the log leaves the device only
  in an export the person starts themselves, encrypted with their own password (PBES2 + A128GCM); never automatically and never to a
  Tamga server. WL4 has been narrowed accordingly.
domain: Wallet
translation_of: ADR-0027
source_version: 1.0.0
---

# Context

SPEC-WALLET-0001 sets two rules:

- **WL4:** `presentation_log` does not leave the device; it is not included in backups.
- **WL2:** a backup carries the credentials and the manifest, not the keys.

Rationale: a record of what was shown to which [[t:verifier]] is the person's behavioural profile; collected on a server, it
becomes a central tracking tool.

The EU position is different:

- **CIR 2024/2979 Art. 9 and 13 and [[t:ARF]] topic 34 (DASH_07, MIG_*):** the wallet keeps a transaction log. The person can
  export a **migration object** containing the log and the list of their [[t:credential]]s, and import it into a new wallet.
- **TS10:** defines the format — a JSON data model, a password-encrypted JWE (`PBES2-HS256+A128KW` + `A128GCM`).

The EU gap analysis (H1, P5) left this open. The migration object code was written (`wallet-core` `ts10.ts`), but because WL4 was a
closed decision the log **was not included** in the file, and the log export button on the history screen (added for DASH_07) was
disabled.

# Decision

## K1 — The text of WL4

The presentation log and the event log leave the device **only in an export started by the person themselves**:

- **TS10 migration file:** encrypted with a password the person chooses; at least 8 characters; PBKDF2 with at least 200,000
  iterations.
- **Transaction log export:** TS10 §4.1; the same encryption.

The file goes wherever the person chooses through the operating system's share menu.

**Under no circumstances:**
- is an export made automatically or in the background,
- is anything uploaded to a Tamga server or any other party's server,
- is a server-side backup taken (SPEC-WALLET-0001 §7.1 stays as it is).

## K2 — Content limit

Credential **values**, copies and keys do not go into the file. The log contains only:
- field names,
- verifier or institution information (from the [[t:trust-list]]),
- time and result.

In the new wallet the credentials are obtained again from the institutions (WL2 unchanged).

## K3 — No unencrypted export

There is no plain JSON log export (`exportLog`); the log is exported only in the TS10 encrypted format.

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| WL4 unchanged, the log is never exported | rejected | The EU requirement (CIR 2024/2979; TS10) is not met; the person cannot reach their own data |
| Encrypted log backup on a Tamga server | rejected | Behavioural data accumulates centrally (metadata even if encrypted); against the purpose of WL4 |
| **A file only the person starts, encrypted with the person's password** | **accepted** | EU-compliant; the data stays under the person's control, Tamga never sees it |
| Plain JSON export | rejected | The file stays readable in file-sharing apps |

# Invariants

| Code | Rule |
|---|---|
| LX1 | The log leaves the device only in an export the person starts, encrypted with the person's password (TS10 §5); there is no automatic or server-bound export. |
| LX2 | The exported log and the migration file contain no credential values, copies or keys. |

# Status

**Accepted — 2026-09-29.** Approved by project management (EU approach for pending decisions). DECISIONS: D-WALLET-2.

Implementation:
- the SPEC-WALLET-0001 WL4 text is written according to this decision,
- log export is enabled in the wallet (TS10 §4.1, password-protected),
- the migration file includes the log; on import the person is asked whether to restore the log (ARF Mig_07b),
- there is no plain JSON export.
