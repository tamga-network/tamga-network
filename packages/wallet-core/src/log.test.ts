/** ARF DASH_06a: günlükten kayıt silme. Dışa aktarım TS10 şifreli (ts10.test.ts, ADR-0027). */
import { describe, it, expect } from "vitest";
import { deleteLogEntries, type WalletState } from "./store.js";
import {
  LOG_RETENTION_OPTIONS_DAYS,
  applyLogRetention,
  logIssuanceFailed,
  logReissued,
  logW2wVerified,
  setLogRetention,
  upcomingLogDeletions,
} from "./log.js";
import { ts10TransactionLog } from "./ts10.js";

const state = {
  version: 1,
  createdAt: 0,
  instanceId: "i",
  credentials: [],
  presentationLog: [
    { ts: 1, clientId: "x509_san_dns:a.example", vct: "v", disclosed: ["email"], outcome: "sent" },
    { ts: 2, clientId: "x509_san_dns:b.example", vct: "v", disclosed: [], outcome: "error" },
  ],
  events: [{ ts: 3, kind: "deleted", vct: "v", typeName: "T" }],
  settings: { biometrics: false },
} as unknown as WalletState;

describe("cüzdan günlüğü", () => {
  it("seçilen kayıtlar silinir, diğerleri kalır", () => {
    const next = deleteLogEntries(state, [1, 3]);
    expect(next.presentationLog.map((e) => e.ts)).toEqual([2]);
    expect(next.events).toEqual([]);
  });
});

describe("0.6.0 olay türleri ve saklama süresi (DASH_02, DASH_02a, STS9_35)", () => {
  const DAY = 86_400_000;
  const NOW = Date.UTC(2026, 9, 13);
  const base = { ...state, presentationLog: [], events: [] } as unknown as WalletState;

  it("issuance_failed / reissued / w2w_verified değer taşımaz", () => {
    let s = logIssuanceFailed(base, {
      vct: "urn:tamga:edu:DiplomaCredential:1",
      typeName: "Diploma",
      issuer: "https://issuer.tamga.network/acme",
      reason: "denied",
      now: NOW,
    });
    s = logReissued(s, { vct: "urn:tamga:id:IdentityAttestation:1", typeName: "Kimlik", now: NOW + 1 });
    s = logW2wVerified(s, { docType: "urn:tamga:id:IdentityAttestation:1", verdict: { kind: "valid" }, now: NOW + 2 });
    expect(s.events).toEqual([
      {
        ts: NOW,
        kind: "issuance_failed",
        vct: "urn:tamga:edu:DiplomaCredential:1",
        typeName: "Diploma",
        issuer: "https://issuer.tamga.network/acme",
        reason: "denied",
      },
      { ts: NOW + 1, kind: "reissued", vct: "urn:tamga:id:IdentityAttestation:1", typeName: "Kimlik" },
      {
        ts: NOW + 2,
        kind: "w2w_verified",
        vct: "urn:tamga:id:IdentityAttestation:1",
        typeName: "urn:tamga:id:IdentityAttestation:1",
        outcome: "valid",
      },
    ]);
    // tam doğrulama sonucu verilse de yalnız `kind` günlüğe girer (alanlar ve değerler yok)
    const full = logW2wVerified(base, {
      docType: "d",
      verdict: {
        kind: "valid",
        issuerName: "X",
        fields: [{ name: "given_name", value: "Ayşe" }],
        revocation: "checked",
      } as never,
      now: NOW,
    });
    expect(JSON.stringify(full.events)).not.toMatch(/Ayşe|given_name|"X"/);
  });

  it("TS10: issuance_failed → CredentialIssuance Failed, reissued → Completed; takma ad ve doğrulayan kipi dışa aktarılmaz", () => {
    let s = logIssuanceFailed(base, { vct: "v", reason: "network", now: NOW });
    s = logReissued(s, { vct: "v", typeName: "T", now: NOW + 1000 });
    s = logW2wVerified(s, { docType: "v", verdict: { kind: "invalid" }, now: NOW + 2000 });
    s = { ...s, events: [...(s.events ?? []), { ts: NOW + 3000, kind: "pseudonym_created", vct: "", typeName: "" }] };
    const txs = ts10TransactionLog(s);
    expect(txs.map((t) => [t.transactionType, t.transactionResult])).toEqual([
      ["CredentialIssuance", "Failed"],
      ["CredentialIssuance", "Completed"],
    ]);
  });

  it("saklama süresi: yalnız sunulan seçenekler; süresiz varsayılan; süresi dolan kayıt silinmeden önce kanca sorulur", async () => {
    expect(() => setLogRetention(base, 45)).toThrow();
    const s0 = {
      ...base,
      presentationLog: [
        { ts: NOW - 40 * DAY, clientId: "a", vct: "v", disclosed: [], outcome: "sent" },
        { ts: NOW - 5 * DAY, clientId: "b", vct: "v", disclosed: [], outcome: "sent" },
      ],
      events: [
        { ts: NOW - 31 * DAY, kind: "deleted", vct: "v", typeName: "T" },
        { ts: NOW - 25 * DAY, kind: "deleted", vct: "v", typeName: "T" },
      ],
    } as unknown as WalletState;
    expect((await applyLogRetention(s0, NOW)).deleted).toBe(0); // süresiz
    const s = setLogRetention(s0, 30);
    expect(s.settings.logRetentionDays).toBe(30);
    expect(LOG_RETENTION_OPTIONS_DAYS).toContain(30);
    // 7 gün içinde silinecekler: bugün süresi dolanlar + 25 günlük olay
    const soon = upcomingLogDeletions(s, NOW);
    expect(soon.presentations.map((e) => e.ts)).toEqual([NOW - 40 * DAY]);
    expect(soon.events.map((e) => e.ts)).toEqual([NOW - 31 * DAY, NOW - 25 * DAY]);
    // kişi "şimdi silme" derse hiçbir şey silinmez
    let asked = 0;
    const kept = await applyLogRetention(s, NOW, (due) => {
      asked++;
      expect(due.presentations).toHaveLength(1);
      expect(due.events).toHaveLength(1);
      return false;
    });
    expect(asked).toBe(1);
    expect(kept.state).toBe(s);
    const done = await applyLogRetention(s, NOW, async () => true);
    expect(done.deleted).toBe(2);
    expect(done.state.presentationLog.map((e) => e.ts)).toEqual([NOW - 5 * DAY]);
    expect(done.state.events?.map((e) => e.ts)).toEqual([NOW - 25 * DAY]);
    expect(setLogRetention(s, null).settings.logRetentionDays).toBeUndefined();
  });
});
