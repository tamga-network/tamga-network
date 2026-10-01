/** ARF DASH_06a: günlükten kayıt silme. Dışa aktarım TS10 şifreli (ts10.test.ts, ADR-0027). */
import { describe, it, expect } from "vitest";
import { deleteLogEntries, type WalletState } from "./store.js";

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
