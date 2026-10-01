/** ADR-0023 K1: eşik (kalan kopya / kalan süre), rastgele gecikme, iptal edilen belgede yenileme yok, teknik alanlar sayılmaz. */
import { describe, it, expect } from "vitest";
import {
  REFRESH_JITTER_MAX_SEC,
  changedClaimNames,
  refreshThresholdReached,
  scheduleRefreshes,
} from "./autorefresh.js";
import type { StoredCredential, WalletState } from "./store.js";

const now = 1_800_000_000;
const cred = (used: number, exp: number, extra: Partial<StoredCredential> = {}): StoredCredential =>
  ({
    id: "c",
    vct: "v",
    typeName: "T",
    issuer: "https://i",
    issuerId: "0x1",
    leafFingerprint: "f",
    iat: now - 10,
    exp,
    claims: {},
    disclosureNames: [],
    copies: Array.from({ length: 10 }, (_, i) => ({
      keyRef: `k${i}`,
      cnf: {},
      combined: "",
      usedBy: i < used ? ["rp"] : [],
    })),
    receivedAt: now,
    refresh: {
      token: "t",
      tokenEndpoint: "https://i/token",
      dpopRef: "d",
      dpopJwk: {} as never,
      unusedTrigger: 2,
      lifetimeTrigger: 7 * 86400,
    },
    ...extra,
  }) as StoredCredential;
const st = (c: StoredCredential) => ({ credentials: [c] }) as unknown as WalletState;

describe("sessiz yenileme zamanlaması", () => {
  it("eşik: 2 kopya kalınca ya da bitişe 7 gün kala", () => {
    expect(refreshThresholdReached(cred(7, now + 60 * 86400), now)).toBe(false);
    expect(refreshThresholdReached(cred(8, now + 60 * 86400), now)).toBe(true);
    expect(refreshThresholdReached(cred(0, now + 6 * 86400), now)).toBe(true);
  });
  it("iptal edilen ya da bağı olmayan belge yenilenmez", () => {
    expect(refreshThresholdReached(cred(9, now + 86400, { status: { value: "revoked", checkedAt: now } }), now)).toBe(
      false,
    );
    expect(refreshThresholdReached(cred(9, now + 86400, { refresh: undefined }), now)).toBe(false);
  });
  it("rastgele gecikme: önce zamanlanır, zamanı gelince hazır olur", () => {
    const a = scheduleRefreshes(st(cred(8, now + 60 * 86400)), now, () => 0.5);
    const dueAt = a.state.credentials[0].refresh!.dueAt!;
    expect(dueAt).toBe(now + Math.floor(0.5 * REFRESH_JITTER_MAX_SEC));
    expect(a.due).toEqual([]);
    expect(scheduleRefreshes(a.state, dueAt).due).toEqual(["c"]);
    // bir kez zamanlanan yeniden zamanlanmaz
    expect(scheduleRefreshes(a.state, now + 1, () => 0.9).state.credentials[0].refresh!.dueAt).toBe(dueAt);
  });
  it("değişen alanlar: teknik alanlar (cnf, iat, exp …) sayılmaz", () => {
    expect(
      changedClaimNames(
        { iat: 1, cnf: { a: 1 }, programme_title: "A" },
        { iat: 2, cnf: { a: 2 }, programme_title: "B" },
      ),
    ).toEqual(["programme_title"]);
  });
});
