/** ADR-0023 K1: eşik (kalan kopya / kalan süre), rastgele gecikme, iptal edilen belgede yenileme yok, teknik alanlar sayılmaz. */
import { describe, it, expect } from "vitest";
import {
  REFRESH_JITTER_MAX_SEC,
  autoRefreshCredential,
  changedClaimNames,
  refreshThresholdReached,
  scheduleRefreshes,
} from "./autorefresh.js";
import type { StoredCredential, WalletState } from "./store.js";
import { AUTH_REQUIRED, SoftwareKeyProvider, MemoryKeyStore, type KeyProvider } from "./keys.js";

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
  it("a3: istemsiz anahtar görünümü doğrulama beklerse (auth_required) tur sessizce atlanır — iptal sayılmaz, istisna yok", async () => {
    const quiet: KeyProvider = {
      generate: async () => ({ kty: "EC", crv: "P-256", x: "", y: "" }),
      publicKey: async () => null,
      sign: async () => {
        throw Object.assign(new Error("key use requires device authentication"), { code: AUTH_REQUIRED });
      },
      delete: async () => {},
      attestation: async () => ({ storage: "software", level: "W1", platform: "test" }),
    };
    let calls = 0;
    const r = await autoRefreshCredential({
      state: st(cred(9, now + 86400)),
      credentialId: "c",
      keys: quiet,
      http: async () => {
        calls++;
        return { status: 500, text: async () => "{}" };
      },
      wua: { jwt: "w", keyRef: "wia.x" } as never,
      randomBytes: (n) => new Uint8Array(n),
      now,
    });
    expect(r).toMatchObject({ ok: false, revoked: false, removedKeyRefs: [] });
    expect(calls).toBe(0); // imza atılamadı → ağa hiç gidilmedi
  });

  it("a3: belge anahtarı doğrulama bekliyorsa belirteç değişimi YAPILMAZ (tek kullanımlık belirteç harcanmaz)", async () => {
    const inner = new SoftwareKeyProvider(new MemoryKeyStore());
    await inner.generate("d");
    await inner.generate("wia.x");
    // protokol anahtarları (DPoP, WIA) istemsiz imzalar; belge anahtarı politikasındaki her yeni anahtar doğrulama bekler
    const quiet: KeyProvider = {
      generate: (ref) => inner.generate(ref),
      publicKey: (ref) => inner.publicKey(ref),
      delete: (ref) => inner.delete(ref),
      attestation: () => inner.attestation(),
      sign: async (ref, d) => {
        if (ref !== "d" && ref !== "wia.x") throw Object.assign(new Error("auth"), { code: AUTH_REQUIRED });
        return inner.sign(ref, d);
      },
    };
    const urls: string[] = [];
    const r = await autoRefreshCredential({
      state: st(cred(9, now + 86400)),
      credentialId: "c",
      keys: quiet,
      http: async (url) => {
        urls.push(url);
        return { status: 200, text: async () => JSON.stringify({ access_token: "a", refresh_token: "t2" }) };
      },
      wua: { jwt: "w", keyRef: "wia.x" } as never,
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
      now,
    });
    expect(r).toMatchObject({ ok: false, revoked: false, reason: "auth_required" });
    expect(urls).toEqual([]); // token uç noktasına hiç gidilmedi
    expect(r.state.credentials[0].refresh!.token).toBe("t");
  });

  it("değişimden sonra imza düşerse yeni yenileme belirteci ve DPoP anahtarı KORUNUR (bağ kopmaz)", async () => {
    const inner = new SoftwareKeyProvider(new MemoryKeyStore());
    await inner.generate("d");
    await inner.generate("wia.x");
    let probed = false;
    const keys: KeyProvider = {
      generate: (ref) => inner.generate(ref),
      publicKey: (ref) => inner.publicKey(ref),
      delete: (ref) => inner.delete(ref),
      attestation: () => inner.attestation(),
      sign: async (ref, d) => {
        if (ref.startsWith("probe.")) probed = true;
        // ön denemeden sonra pencere kapandı: kopya proof imzası düşer
        else if (ref !== "d" && ref !== "wia.x") throw Object.assign(new Error("auth"), { code: AUTH_REQUIRED });
        return inner.sign(ref, d);
      },
    };
    const http = async (url: string) => {
      if (url === "https://i/token")
        return {
          status: 200,
          text: async () => JSON.stringify({ access_token: "a", refresh_token: "t2" }),
        };
      if (url === "https://i/nonce") return { status: 200, text: async () => JSON.stringify({ c_nonce: "n" }) };
      return {
        status: 200,
        text: async () =>
          JSON.stringify({
            credential_issuer: "https://i",
            credential_endpoint: "https://i/credential",
            nonce_endpoint: "https://i/nonce",
            credential_configurations_supported: { v: { format: "dc+sd-jwt", vct: "v" } },
          }),
      };
    };
    const r = await autoRefreshCredential({
      state: st(cred(9, now + 86400)),
      credentialId: "c",
      keys,
      http,
      wua: { jwt: "w", keyRef: "wia.x" } as never,
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
      now,
    });
    expect(probed).toBe(true);
    expect(r).toMatchObject({ ok: false, revoked: false, reason: "auth_required", removedKeyRefs: [] });
    expect(r.state.credentials[0].refresh!.token).toBe("t2"); // döndürülen belirteç saklandı
    expect(await inner.publicKey("d")).not.toBeNull(); // DPoP anahtarı silinmedi
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

describe("ADR-0060 K2: invalid_grant ile bağ kalkınca örnek anahtarı", () => {
  const invalidGrant = async () => ({
    status: 400,
    text: async () => JSON.stringify({ error: "invalid_grant", error_description: "x" }),
  });
  async function run(state: WalletState) {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    await keys.generate("d");
    await keys.generate("inst.1");
    return autoRefreshCredential({
      state,
      credentialId: "c",
      keys,
      http: invalidGrant,
      wua: { jwt: "w", keyRef: "inst.1" } as never,
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
      now,
    });
  }
  const bound = (id: string) =>
    cred(9, now + 86400, { id, refresh: { ...cred(0, 0).refresh!, instanceKeyRef: "inst.1" } });

  it("başka yerde kullanılmıyorsa silinecekler listesine girer (yetim anahtar kalmaz)", async () => {
    const r = await run(st(bound("c")));
    expect(r).toMatchObject({ ok: false, revoked: true });
    expect(r.removedKeyRefs).toEqual(["d", "inst.1"]);
    expect(r.state.credentials[0].refresh).toBeUndefined();
  });
  it("başka belgenin bağında ya da cüzdanın WIA'sında kullanılıyorsa silinmez", async () => {
    const other = { credentials: [bound("c"), bound("c2")] } as unknown as WalletState;
    expect((await run(other)).removedKeyRefs).toEqual(["d"]);
    const withWia = { credentials: [bound("c")], wua: { keyRef: "inst.1" } } as unknown as WalletState;
    expect((await run(withWia)).removedKeyRefs).toEqual(["d"]);
  });
});
