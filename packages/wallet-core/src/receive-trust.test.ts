/** C6-K1 (güvenlik incelemesi 2026-11-18): belge alma ve yenilemede güven kaynağı kapısı — `assertReceiveTrust` ve yenileme girişleri. */
import { describe, it, expect } from "vitest";
import type { TrustSource } from "@tamga-network/trust/core";
import { assertReceiveTrust } from "./receive-trust.js";
import { renewIdentityCredential } from "./identity-renewal.js";
import { autoRefreshCredential } from "./autorefresh.js";
import { newState } from "./store.js";
import { MemoryKeyStore, SoftwareKeyProvider } from "./keys.js";

const source = { isCredentialAcceptable: () => "YES" } as unknown as TrustSource;

describe("assertReceiveTrust", () => {
  it('açık "none" ve gerçek güven kaynağı geçer', () => {
    expect(() => assertReceiveTrust({ trust: "none" })).not.toThrow();
    expect(() => assertReceiveTrust({ trust: source })).not.toThrow();
  });

  it("seçenek yok, trust yok, boş nesne, başka dize ya da işlevsiz nesne reddedilir (JavaScript çağıran dahil)", () => {
    const bad: unknown[] = [
      undefined,
      {},
      { trust: undefined },
      { trust: {} },
      { trust: "yes" },
      { trust: null },
      { trust: 1 },
    ];
    for (const b of bad)
      expect(() => assertReceiveTrust(b as never), JSON.stringify(b)).toThrow(/trust source missing/);
  });
});

describe("yenileme girişleri güven kapısını AĞA ÇIKMADAN denetler", () => {
  const run = (fn: unknown, receive: unknown) => {
    const urls: string[] = [];
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const p = {
      state: newState("w"),
      credentialId: "c",
      keys,
      http: async (url: string) => {
        urls.push(url);
        return { status: 200, text: async () => "{}" };
      },
      wua: { jwt: "w", keyRef: "d" },
      randomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
      now: 1_800_000_000,
      receive,
    };
    return { urls, result: (fn as (x: unknown) => Promise<unknown>)(p) };
  };

  it("renewIdentityCredential: receive yok ya da trust yok → hata, ağ çağrısı yok", async () => {
    for (const r of [undefined, {}, { trust: {} }]) {
      const { urls, result } = run(renewIdentityCredential, r);
      await expect(result).rejects.toThrow(/trust source missing/);
      expect(urls).toEqual([]);
    }
  });

  it("autoRefreshCredential: receive yok ya da trust yok → hata, ağ çağrısı yok", async () => {
    for (const r of [undefined, {}]) {
      const { urls, result } = run(autoRefreshCredential, r);
      await expect(result).rejects.toThrow(/trust source missing/);
      expect(urls).toEqual([]);
    }
  });

  it('trust: "none" kapıyı geçer (kimlik belgesi bulunamayınca nazikçe atlanır, istisna yok)', async () => {
    const { urls, result } = run(renewIdentityCredential, { trust: "none" });
    await expect(result).resolves.toMatchObject({ ok: false, reason: "not an identity credential" });
    expect(urls).toEqual([]);
  });
});
